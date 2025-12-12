// useBookingForm composable
// =========================
// Centralizes state and logic for the booking form flow
// now implemented in front/booking.js.
//
// Responsibilities (to implement later):
// - Hold reactive state:
//   - token (prebook token from route query).
//   - bookingStatus message and type.
//   - current partner order id.
//   - prebook summary and payload (from session storage and/or API).
//   - customer data (civility, name, email, phone, address, country, notes).
//   - payment method selection and Floa product.
//   - loading flags for API calls.
// - Provide actions:
//   - loadFromSession(): read PREBOOK_SUMMARY_KEY, LAST_CUSTOMER_KEY from sessionStorage.
//   - refreshBookingForm(): call requestBookingForm and update summary.
//   - startFloaDeal(): call createFloaHotelDeal and manage deal reference.
//   - finalizeFloaDeal(): call finalizeFloaDeal API and handle success/error.
//   - persistCustomer(): write LAST_CUSTOMER_KEY to sessionStorage.
// - Expose helpers to format price and derive hotel/stay summary.
//
// This composable will be imported by BookingView.vue and possibly PaymentSuccessView.vue.

