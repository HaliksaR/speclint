final class TicketsTests: XCTestCase {
    // spec:app/show-tickets#online
    func testOnline() { s(#"WHEN the phone is online"#); s("THEN tickets sync") }

    // spec:booking:reservations/cancel-reservation
    func testCancel() { s("WHEN the client cancels 24 hours before the event") }
}
