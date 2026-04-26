asd## Do NOT EDIT or COMMIT ".env" file ! 
# . push test . 2. .
,
.
.
Deployment notes. 
    cd BedTrip_ui/
    unset NODE_ENV
    node --version
    npm ci
    npx vite build
    cd ..
    npm ci
    npm run build
    npm run build:ui
    pkill -f node


## API
    api/b2b/v3/hotel/info
    - Paiement par carte (Kotan Payments) 
    - 

## Chatbot assistant
Routes:
    GET /api/chatbot/config
    POST /api/chatbot/message

Frontend:
    BedTrip_ui/src/components/chatbot/ChatWidget.vue
    The widget is enabled on the supported Vue routes configured in config/chatbotConfig.js.

How it works:
    - The frontend sends the user message plus route and booking context to POST /api/chatbot/message.
    - services/chatbotService.js normalizes the text and scores it against config/chatbotConfig.js intents.
    - The selected intent returns an answer, quick replies, and optional UI payloads:
        highlights: colored important information blocks.
        promoCodes: copyable promo-code cards.
        links: useful action links, for example /blog.
    - The chatbot does not create bookings or payments. It only guides the user and reads public promo-code summaries.

Main keywords to test:
    Promo codes:
        promo, code promo, codes promo, discount, reduction, remise, coupon
    Destinations / blog:
        meilleures destinations, best destination, ou aller, idee voyage, inspiration, vacances, blog
    Contact:
        contact, support, aide, telephone, phone, email support, mail support
    Payment:
        paiement, payer, carte, 3x, 4x, systempay, floa, cofidis
    Cancellation:
        annulation, annuler, remboursement, refundable, cancellation policy
    Booking:
        reservation, booking, reference, confirmation, bon hotel, voucher

Contact shown by chatbot:
    Phone: 02 35 08 22 49
    Email: kotanvoyages@outlook.com

## New updates 
    - Added date field (bookingView)
    - Removed filter(hotel & appartement)
    - Added banner (to show user can pay in installement)
    - merge dev into master(quick test build)
    - Added map filtering and distances
    - I’m now removing robots.txt from git tracking (keeping the file locally) so future builds won’t block pulls
    - Replaced “loading text only” with gallery skeleton loading.
    - During retry phase, skeleton stays visible with loading note.
    - Added fallback image fetch limits (15 -> 10 -> 6 -> 3 -> 1) when provider is saturated.
    - Added graceful handling for endpoint_exceeded_limit (no raw error exposed).
    - Added automatic retries with cooldown and manual Réessayer button.
    - Added visible loading banner + spinner while results load.
    - Kept skeleton, but now users clearly see active loading state.
    - chatbot, Promocode, image re optimation all present in the new version bedtrip

