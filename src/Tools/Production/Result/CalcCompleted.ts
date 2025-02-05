import { Numbers } from '@src/Utils/Numbers';
import { Graph } from './Graph';
import { ByproductNode } from './Nodes/ByproductNode';
import { ProductNode } from './Nodes/ProductNode';
import { RecipeNode } from './Nodes/RecipeNode';
import { SinkNode } from './Nodes/SinkNode';

export class CalcCompleted {
	private indent: number = 0;

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
			const output = Numbers.round(node
				.getEdgesOut()
				.map((x) => x.itemAmount.getAvailable())
				.reduce((acc, sum) => acc + sum, 0));

			node.visible = node.isAvailable()
				&& (this.graph.settings.showCompleted
					|| output > 0
					|| node instanceof ProductNode
					|| node instanceof SinkNode
					|| node instanceof ByproductNode
					|| node.highlighted === 'product'
					|| node.highlighted === 'dependent');
		}
	}

	private updateNodeCompletion(node: RecipeNode): void {
		const indent = '   |'.repeat(this.indent)
		console.log(`${indent}updateNodeCompletion(node=${node.id}, recipe=${node.recipeData.recipe.className})`);

		const outputsUsed = node.getOutputs().map((output) => {
			let consumed = 0;
			let total = 0;

			console.log(`${indent}  Consider output (output=${output.resource.className})`);

			for (const edge of node.getEdgesOut(output.resource.className)) {
				if (edge.to.isAvailable() && !edge.isLoop()) {
					console.log(`${indent}    Apply output (node=${edge.to.id}, consumed=${edge.itemAmount.consumed}, amount=${edge.itemAmount.getAmount()})`);

					consumed += edge.itemAmount.consumed;
					total += edge.itemAmount.getAmount();
				}
			}

			console.log(`${indent}  Done (total=${total}, consumed=${consumed})`);

			return total === 0
				? 1.0
				: consumed / total;
		});

		const outputUsed = Math.min(...outputsUsed);
		const outputCompleted = outputUsed * node.getAmount();

		const userCompleted = this.graph.completedMap[node.recipeData.recipe.className] || 0.0;

		const completedTotal = Math.min(outputCompleted + userCompleted, node.getAmount());

		console.log(`${indent}Consumed values(node=${node.id}, outputUsed=${outputUsed}, outputCompleted=${outputCompleted}, userCompleted=${userCompleted}, completedTotal=${completedTotal})`);

		this.setNodeCompleted(node, completedTotal);
	}

	private setNodeCompleted(node: RecipeNode, completed: number) {
		const diff = completed - node.completed;
		const percentage = 100.0 * diff / node.getAmount();

		const indent = '   |'.repeat(this.indent)
		console.log(`${indent}setNodeCompleted(node=${node.id}, recipe=${node.recipeData.recipe.className}, completed=${completed}, amount=${node.getAmount()}, diff=${diff}, percentage=${percentage}, speed=${node.recipeData.machine.metadata.manufacturingSpeed}, time=${node.recipeData.recipe.time})`);

		if (Numbers.floor(diff) <= 0) {
			return;
		}

		node.completed = completed;
		const inputs = node.getInputs();
		const multiplier = node.getMultiplier(diff);

		for (const input of inputs) {
			const ingredient = node.recipeData.recipe.ingredients.find((x) => x.item === input.resource.className);
			if (!ingredient) {
				continue;
			}

			const edges = node.getEdgesIn(input.resource.className);
			const inputAmount = ingredient.amount * multiplier;
			const totalAvailable = edges
				.map((edge) => edge.from.isAvailable()
					? edge.itemAmount.getAvailable()
					: 0.0)
				.reduce((acc, sum) => acc + sum, 0);

			console.log(`${indent}  Reduce ingredient (node=${node.id}, item=${ingredient.item}, ` +
				`inputAmount=${inputAmount}, totalAvailable=${totalAvailable}, amount=${ingredient.amount}, multiplier=${multiplier})`);

			if (totalAvailable <= 0) {
				continue;
			}

			for (const edge of edges) {
				if (!edge.from.isAvailable()) {
					continue;
				}

				const edgeAvailable = edge.itemAmount.getAvailable();
				const ratio = edgeAvailable / totalAvailable;
				const relativeEdgeAmount = ratio * inputAmount;
				const consumed = edge.itemAmount.increaseConsumed(relativeEdgeAmount);

				console.log(`${indent}    Consumed (node=${node.id}, other=${edge.from.id}, edgeAvailable=${edgeAvailable}, ratio=${ratio}, relativeEdgeAmount=${relativeEdgeAmount}, consumed=${consumed}, newConsumed=${edge.itemAmount.consumed})`);
			}
		}

		console.log(`${indent}  Update dependencies (node=${node.id})`);

		for (const edge of node.getEdgesIn()) {
			if (	edge.from.isAvailable()
				&&  edge.to !== edge.from
				&& 	edge.from instanceof RecipeNode)
			{
				this.indent += 1;
				this.updateNodeCompletion(edge.from);
				this.indent -= 1;
			}
		}
	}
}
