# spec:auth/logout
def test_logout():
    step(f"GIVEN a signed-in user")
    step(r'WHEN the user presses Log out')
    # step("THEN the session ends")
