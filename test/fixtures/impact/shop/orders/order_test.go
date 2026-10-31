package orders

import "testing"

// spec:orders:order/checkout#total-with-tax
func TestTotalWithTax(t *testing.T) {
	if Total(200) != 240 {
		t.Fatal("total")
	}
}

// spec:orders:order/checkout#confirmed
func TestConfirmed(t *testing.T) {
	if Confirm(true) != "confirmed" {
		t.Fatal("confirm")
	}
}
