export class ItemAmount
{

	public consumed: number = 0.0;
	public limit?: number;

	public constructor(public readonly item: string, public amount: number)
	{
	}

	public increaseConsumed(diff: number): number {
		const available = this.getAvailable();
		if (diff < available) {
			this.consumed += diff;

			return 0;
		} else if (diff > available) {
			this.consumed = this.amount;

			return available;
		} else {
			this.consumed += diff;

			return diff;
		}
	}

	public increaseLimit(diff: number): number {
		const buffer = this.getBuffer();
		if (diff < buffer) {
			this.limit = (this.limit || 0) + diff;

			return 0;
		} else if (diff > buffer) {
			this.limit = buffer;

			return buffer;
		} else {
			this.limit = (this.limit || 0) + diff;

			return diff;
		}
	}

	public getConsumed(): number {
		return this.consumed;
	}

	public getAvailable(): number {
		return this.getAmount() - this.consumed;
	}

	public getBuffer(): number {
		return this.amount - (this.limit || 0);
	}

	public getAmount(): number {
		return this.limit === undefined
			? this.amount
			: this.limit;
	}

}
