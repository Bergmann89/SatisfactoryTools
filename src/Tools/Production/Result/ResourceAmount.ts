import {IItemSchema} from '@src/Schema/IItemSchema';

export class ResourceAmount
{

	public readonly DELTA = 1e-8;

	public constructor(public readonly resource: IItemSchema, public readonly maxAmount: number, public amount: number)
	{
	}

	public increase(diff: number) {
		this.amount += diff;

		if (Math.abs(this.maxAmount - this.amount) < this.DELTA) {
			this.amount = this.maxAmount;
		}
	}

	public decrease(diff: number) {
		this.amount -= diff;

		if (Math.abs(this.amount) < this.DELTA) {
			this.amount = 0;
		}
	}

}
