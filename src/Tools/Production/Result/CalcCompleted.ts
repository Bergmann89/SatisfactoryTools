import { Graph } from './Graph';
import { ByproductNode } from './Nodes/ByproductNode';
import { ProductNode } from './Nodes/ProductNode';
import { RecipeNode } from './Nodes/RecipeNode';
import { SinkNode } from './Nodes/SinkNode';

export class CalcCompleted {
	public constructor(protected readonly graph: Graph) { }

	public update() {
		this.resetConsumed();
		this.updateInternal();
		this.updateVisibility();
	}

	protected updateInternal() {
		if (this.graph.settings.applyCompleted) {
			for (const node of this.graph.nodes) {
				if (node instanceof RecipeNode) {
					if (this.graph.completedMap[node.recipeData.recipe.className]) {
						this.updateNodeCompletion(node);
					}
				}
			}
		}
	}

	protected resetConsumed() {
		for (const node of this.graph.nodes) {
			if (node instanceof RecipeNode) {
				(node as RecipeNode).completed = 0;
				(node as RecipeNode).limit = undefined;
			}

			for (const edge of node.connectedEdges) {
				edge.itemAmount.consumed = 0;
				edge.itemAmount.limit = undefined;
			}
		}
	}

	protected updateVisibility() {
		for (const node of this.graph.nodes) {
			const output = node.getEdgesOut().map((x) => x.itemAmount.getAvailable()).reduce((acc, sum) => acc + sum, 0);

			node.visible = (
				this.graph.settings.showCompleted
					|| output > this.graph.DELTA
					|| node instanceof ProductNode
					|| node instanceof SinkNode
					|| node instanceof ByproductNode
					|| node.highlighted === 'product'
					|| node.highlighted === 'dependent')
				&& (node.isAvailable(this.graph.settings));
		}
	}

	private updateNodeCompletion(node: RecipeNode): void {
		const outputsUsed = node.getOutputs().map((output) => {
			let consumed = 0;
			let total = 0;

			for (const edge of node.getEdgesOut(output.resource.className)) {
				consumed += !edge.to.isAvailable(this.graph.settings)
								|| edge.to.hasOutputTo(edge.from)
					? edge.itemAmount.getAmount()
					: edge.itemAmount.consumed;
				total += edge.itemAmount.getAmount();
			}

			return total === 0
				? 0.0
				: consumed / total;
		});
		const outputUsed = Math.min(...outputsUsed);
		const outputCompleted = outputUsed * node.getAmount();

		const userCompleted = this.graph.completedMap[node.recipeData.recipe.className] || 0.0;

		const completedTotal = Math.min(outputCompleted + userCompleted, node.getAmount());

		this.setNodeCompleted(node, completedTotal);
	}

	private setNodeCompleted(node: RecipeNode, completed: number) {
		const diff = completed - node.completed;
		if (diff <= 0) {
			return;
		}

		console.log(`setNodeCompleted(node=${node.id}, recipe=${node.recipeData.recipe}, completed=${completed}, diff=${diff})`);

		node.completed = completed;
		const multiplier = node.getMultiplier(diff);

		for (const input of node.getInputs()) {
			const ingredient = node.recipeData.recipe.ingredients.find((x) => x.item === input.resource.className);
			if (!ingredient) {
				continue;
			}

			let inputAmount = ingredient.amount * multiplier;

			for (const edge of node.getEdgesIn(input.resource.className)) {
				if (   !edge.from.isAvailable(this.graph.settings)
					||  edge.to.hasOutputTo(edge.from)) {
					continue;
				}

				inputAmount -= edge.itemAmount.increaseConsumed(inputAmount);

				if (edge.from instanceof RecipeNode) {
					this.updateNodeCompletion(edge.from);
				}

				if (Math.abs(inputAmount) < this.graph.DELTA) {
					break;
				}
			}

			for (const edge of node.getEdgesIn(input.resource.className)) {
				if (edge.from.isAvailable(this.graph.settings)) {
					continue;
				}

				inputAmount -= edge.itemAmount.increaseConsumed(inputAmount);

				if (edge.from instanceof RecipeNode) {
					this.updateNodeCompletion(edge.from);
				}

				if (Math.abs(inputAmount) < this.graph.DELTA) {
					break;
				}
			}
		}
	}
}
