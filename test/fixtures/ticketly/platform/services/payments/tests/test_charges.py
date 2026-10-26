def test_card_approved():
    """spec:charges/capture-payment#card-approved"""
    steps = [f"WHEN the bank approves the card", r'THEN the payment is captured']
    # spec:charges/ghost
