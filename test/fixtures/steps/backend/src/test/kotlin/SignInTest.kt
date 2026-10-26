class SignInTest {
    @Spec("spec:auth/sign-in#valid-password")
    @Test
    fun `THEN sign-in is refused`() {
        step("WHEN the user enters a valid password")
        // step("THEN the user is signed in")
        step("""
            THEN the user is signed in
        """)
    }
}
