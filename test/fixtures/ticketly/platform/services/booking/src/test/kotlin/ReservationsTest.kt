class ReservationsTest {
    // spec:reservations/hold-seats#seats-held
    @Test fun seatsHeld() {
        step("WHEN the client selects free seats")
        step("THEN the seats are held for 10 minutes")
    }

    // spec:reservations/hold-seats#hold-expires
    @Test fun holdExpires() {
        val given = """GIVEN a hold older than 10 minutes"""
        step("WHEN the expiry job runs")
        step("THEN the seats return to Sale")
    }

    @Test fun `spec:reservations/cancel-reservation`() {
        step("WHEN the client cancels 24 hours before the event")
        step("THEN the full price is refunded")
    }

    // spec:reservations/тайм-аут-брони#истечение
    @Test fun timeout() {
        step("WHEN срок брони истёк")
        step("THEN бронь снимается")
    }

    // spec:reservations/old-thing
    @Test fun legacy() { val s = "it's \"quoted\" // not a comment" }
}
