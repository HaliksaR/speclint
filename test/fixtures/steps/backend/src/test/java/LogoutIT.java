class LogoutIT {
    @DisplayName("spec:auth/logout#manual-logout")
    @Test
    void logsOut() {
        step("""
            GIVEN a signed-in user""");
        step("THEN the session \"ends\"");
    }
}
