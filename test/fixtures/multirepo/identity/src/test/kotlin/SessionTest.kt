class SessionTest {
    @Spec("spec:auth/session-timeout#idle-timeout")
    @Test
    fun idle() {
        step("WHEN the user is idle for 30 minutes")
        step("THEN the session ends")
    }

    @Spec("spec:auth/log-in")
    @Test
    fun logIn() {
        step("WHEN the password is valid")
        step("THEN the user is signed in")
    }

    @Spec("spec:web:checkout/pay#card")
    @Test
    fun paysByCard() {}
}
