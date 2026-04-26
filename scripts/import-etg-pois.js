"use strict";

const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
const StreamArray = require("stream-json/streamers/StreamArray");
const JsonlParser = require("stream-json/jsonl/Parser");

dotenv.config();

const hotelPoiRepository = require("../repositories/hotelPoiRepository");
const hotelPoiService = require("../services/hotelPoiService");

function parseArgs(argv = []) {
  const options = {
    file: path.join(process.cwd(), "data", "feed_pois_en_v3.json"),
    batchSize: hotelPoiService.IMPORT_LIMITS.batchSize,
    logEveryHotels: hotelPoiService.IMPORT_LIMITS.logEveryHotels,
    pruneMissing: false,
    sourceName: hotelPoiService.DEFAULT_IMPORT_SOURCE_NAME,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, rawValue] = arg.slice(2).split("=");
    const value = rawValue === undefined ? "true" : rawValue;
    if (key === "file" && value) options.file = path.resolve(process.cwd(), value);
    if (key === "batch-size" && value) options.batchSize = Number(value) || options.batchSize;
    if (key === "log-every-hotels" && value) options.logEveryHotels = Number(value) || options.logEveryHotels;
    if (key === "source-name" && value) options.sourceName = String(value).trim() || options.sourceName;
    if (key === "prune-missing") options.pruneMissing = value !== "false";
  }

  return options;
}

function createStats() {
  return {
    processedHotels: 0,
    processedPois: 0,
    keptPois: 0,
    skippedPois: 0,
    malformedHotels: 0,
    malformedPois: 0,
    upsertedPois: 0,
    prunedPois: 0,
  };
}

function createHotelObjectStream(filePath, format, errorSamples) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  if (format === "json_array") {
    return input.pipe(StreamArray.withParser());
  }

  return input.pipe(
    new JsonlParser({
      errorIndicator: (error, rawLine) => {
        hotelPoiService.recordErrorSample(errorSamples, "malformed_json_line", {
          reason: error.message,
          line_preview: String(rawLine || "").slice(0, 240),
        });
        return undefined;
      },
    })
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const errorSamples = [];
  const stats = createStats();

  if (!fs.existsSync(options.file)) {
    throw new Error(`POI dump file not found: ${options.file}`);
  }

  await hotelPoiRepository.ensureHotelPoiSchema();
  const sourceFormat = await hotelPoiService.detectDumpFormat(options.file);
  const runId = await hotelPoiRepository.createImportRun({
    sourceName: options.sourceName,
    sourceFile: options.file,
    sourceFormat,
    notes: {
      batchSize: options.batchSize,
      logEveryHotels: options.logEveryHotels,
      pruneMissing: options.pruneMissing,
    },
  });

  const importerOptions = {
    runId,
    sourceName: options.sourceName,
  };

  console.log(
    `[ETG POI IMPORT] started | file=${options.file} | format=${sourceFormat} | batchSize=${options.batchSize} | pruneMissing=${options.pruneMissing}`
  );

  const batch = [];

  try {
    const stream = createHotelObjectStream(options.file, sourceFormat, errorSamples);

    for await (const chunk of stream) {
      const prepared = hotelPoiService.prepareHotelPoiRows(chunk?.value, errorSamples);
      hotelPoiService.mergeStats(stats, prepared.stats);

      if (prepared.rows.length) {
        batch.push(...prepared.rows);
      }

      if (batch.length >= options.batchSize) {
        await hotelPoiService.flushImportBatch(batch, importerOptions, stats);
      }

      if (stats.processedHotels > 0 && stats.processedHotels % options.logEveryHotels === 0) {
        await hotelPoiRepository.updateImportRunProgress(runId, stats);
        console.log(hotelPoiService.buildLogLine(stats, startedAt, { batch: batch.length }));
      }
    }

    await hotelPoiService.flushImportBatch(batch, importerOptions, stats);

    if (options.pruneMissing) {
      stats.prunedPois = await hotelPoiRepository.pruneMissingHotelPois(runId, options.sourceName);
    }

    await hotelPoiRepository.finalizeImportRun(runId, {
      status: errorSamples.length ? "completed_with_warnings" : "completed",
      stats,
      errorSamples,
      notes: {
        duration_ms: Date.now() - startedAt,
      },
    });

    console.log(hotelPoiService.buildLogLine(stats, startedAt));
    console.log(
      `[ETG POI IMPORT] completed | runId=${runId} | pruned=${stats.prunedPois} | warnings=${errorSamples.length}`
    );
  } catch (error) {
    await hotelPoiRepository.finalizeImportRun(runId, {
      status: "failed",
      stats,
      errorSamples,
      notes: {
        duration_ms: Date.now() - startedAt,
        error: error.message,
      },
    });
    throw error;
  }
}

main().catch((error) => {
  console.error("[ETG POI IMPORT] failed", error);
  process.exit(1);
});

