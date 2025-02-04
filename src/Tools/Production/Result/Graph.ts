import {GraphNode} from '@src/Tools/Production/Result/Nodes/GraphNode';
import {GraphEdge} from '@src/Tools/Production/Result/Edges/GraphEdge';
import {ItemAmount} from '@src/Tools/Production/Result/ItemAmount';
import {IProductionDataRequestCompleted} from '@src/Tools/Production/IProductionData';
import {RecipeNode} from '@src/Tools/Production/Result/Nodes/RecipeNode';
import {IItemSchema} from '@src/Schema/IItemSchema';

export class Graph
{

	public readonly DELTA = 1e-8;

	public nodes: GraphNode[] = [];
	public edges: GraphEdge[] = [];

	private lastId = 1;
	private completedMap: CompletedMap = { };
	private outputToNodeMap?: ItemToNodeMap;

	public addNode(node: GraphNode): void
	{
		this.nodes.push(node);
		this.outputToNodeMap = undefined;
		node.id = this.lastId++;
	}

	public addEdge(edge: GraphEdge): void
	{
		this.edges.push(edge);
		edge.id = this.lastId++;
	}

	public generateEdges(): void
	{
		this.edges = [];

		const outputToNodeMap = this.getOutputToNodeMap();

		for (const nodeIn of this.nodes) {
			for (const input of nodeIn.getInputs()) {
				const nodesOut = outputToNodeMap[input.resource.className];
				for (const nodeOut of nodesOut) {
					for (const output of nodeOut.getOutputs()) {
						if (input.resource === output.resource && input.amount < input.maxAmount) {
							const diff = Math.min(input.maxAmount - input.amount, output.amount);

							output.decrease(diff);
							input.increase(diff);

							this.addEdge(new GraphEdge(nodeOut, nodeIn, new ItemAmount(output.resource.className, diff)));
						}
					}
				}
			}
		}
	}

	public applyCompleted(completed: IProductionDataRequestCompleted[]): void {
		this.completedMap = { };
		for (const item of completed) {
			if (item.recipe) {
				this.completedMap[item.recipe] = this.completedMap[item.recipe] || 0;
				this.completedMap[item.recipe] += item.amount;
			}
		}

		for (const node of this.nodes) {
			if (node instanceof RecipeNode) {
				if (this.completedMap[node.recipeData.recipe.className]) {
					this.updateNodeCompletion(node);
				}
			}
		}
	}

	private updateNodeCompletion(node: RecipeNode): void {
		const outputsUsed = node.getOutputs().map((x) => 1.0 - (x.amount / x.maxAmount));
		const outputUsed = Math.min(...outputsUsed);
		const outputCompleted = outputUsed * node.recipeData.amount;

		const userCompleted = this.completedMap[node.recipeData.recipe.className] || 0.0;

		const completedTotal = outputCompleted + userCompleted;

		this.setNodeCompleted(node, completedTotal);
	}

	private setNodeCompleted(node: RecipeNode, completed: number) {
		const diff = completed - (node.completed || 0);
		if (diff <= 0) {
			return;
		}

		node.completed = completed;
		const multiplier = node.getMultiplier(diff);

		for (const input of node.getInputs()) {
			const ingredient = node.recipeData.recipe.ingredients.find((x) => x.item === input.resource.className);
			if (!ingredient) {
				continue;
			}

			let inputAmount = ingredient.amount * multiplier;
			input.increase(inputAmount);

			const productToNodeMap = this.getOutputToNodeMap();
			const productNodes = productToNodeMap[input.resource.className] || [];
			for (const productNode of productNodes) {
				inputAmount -= this.reduceNodeOutput(productNode, input.resource, inputAmount);
				if (Math.abs(inputAmount) < this.DELTA) {
					break;
				}
			}
		}
	}

	private reduceNodeOutput(node: GraphNode, product: IItemSchema, amount: number): number {
		const output = node.getOutputs().find((x) => x.resource.className === product.className);
		if (!output) {
			return 0.0;
		}

		const realAmount = Math.min(amount, output.amount);
		output.amount -= realAmount;

		if (node instanceof RecipeNode) {
			this.updateNodeCompletion(node);
		}

		return realAmount;
	}

	private getOutputToNodeMap(): ItemToNodeMap {
		if (!this.outputToNodeMap) {
			this.outputToNodeMap = { };

			for (const node of this.nodes) {
				for (const output of node.getOutputs()) {
					const className = output.resource.className;
					const  nodeList = this.outputToNodeMap[className] || [];
					nodeList.push(node);
					this.outputToNodeMap[className] = nodeList;
				}
			}
		}

		return this.outputToNodeMap;
	}

}

interface ItemToNodeMap { [key:string]: GraphNode[] }
interface CompletedMap { [key:string]: number }
