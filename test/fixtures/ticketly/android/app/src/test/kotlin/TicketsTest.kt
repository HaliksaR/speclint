class TicketsTest {
    // spec:app/show-tickets#offline
    @Test fun offline() { s("WHEN the phone is offline"); s("THEN cached tickets are shown") }

    // spec:booking:reservations/hold-seats#seats-held
    @Test fun hold() { s("WHEN the client selects free seats"); s("THEN the seats are held for 10 minutes") }

    // spec:booking:reservations/reserve-seats
    @Test fun old() {}

    // spec:payments:charges/refund
    @Test fun refund() {}
}
