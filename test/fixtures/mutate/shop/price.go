package shop

func Price(items int) int {
	if items > 10 {
		return items * 2
	}
	return items
}

func Discount(total int) int {
	if total >= 100 {
		return total - 10
	}
	return total
}
