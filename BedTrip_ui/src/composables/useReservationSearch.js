// useReservationSearch composable
// ==============================
// Centralizes state and logic for the hotel search and prebooking flow
// currently implemented in front/reservation.js.
//
// Responsibilities (to implement later):
// - Manage search parameters:
//   - destination input, selected suggestion.
//   - date range (checkin, checkout).
//   - rooms and guests counts + children ages.
//   - filters (stars, meal, facilities, price range, free cancellation, etc.).
// - Handle search lifecycle:
//   - Build payload for search API based on current filters and params.
//   - Call search endpoint via httpClient and maintain loading + error state.
//   - Map raw search results into UI-friendly objects (hotel, images, rates, etc.).
// - Support autocomplete:
//   - Call suggestion/autocomplete endpoint when user types destination.
//   - Debounce input, cache previous results where appropriate.
// - Coordinate UI:
//   - Provide computed lists for:
//     - Visible hotels.
//     - Selected hotel details.
//   - Expose derived counts (total results, applied filters).
// - Connect with booking:
//   - Trigger prebook API call when user selects a rate to book.
//   - Store summary in sessionStorage (PREBOOK_SUMMARY_KEY) for use by booking/payment pages.

