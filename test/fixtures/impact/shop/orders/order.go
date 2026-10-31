package orders

import "example.com/shop/billing"

func Total(price int) int {
	return price + billing.Tax(price)
}

func Confirm(paid bool) string {
	if paid {
		return "confirmed"
	}
	return "pending"
}
