import type { Station } from "./types";

export type RoutingGraph = NonNullable<Station["routing"]>;
export interface RouteResult {
  path: string[];
  cost: number;
}
export interface RouteValidation {
  valid: boolean;
  optimal: boolean;
  cost: number | null;
  optimalCost: number | null;
  feedback: string;
}

function adjacency(graph: RoutingGraph): Map<string, Map<string, number>> {
  if (
    new Set(graph.nodes).size !== graph.nodes.length ||
    graph.nodes.some((node) => !node.trim())
  ) {
    throw new TypeError("Graph node names must be nonempty and unique.");
  }
  const map = new Map(
    graph.nodes.map((node) => [node, new Map<string, number>()]),
  );
  if (!map.has(graph.start) || !map.has(graph.end)) {
    throw new TypeError("Start and destination must be graph nodes.");
  }
  for (const { from, to, weight } of graph.edges) {
    if (!map.has(from) || !map.has(to))
      throw new TypeError("Every path must join known nodes.");
    if (!Number.isFinite(weight) || weight < 0)
      throw new RangeError("Travel costs must be finite and nonnegative.");
    // A path is selected by its endpoints; duplicate entries represent one path.
    if (map.get(from)!.has(to))
      throw new TypeError(
        "Paths between the same nodes must not be duplicated.",
      );
    map.get(from)!.set(to, weight);
    map.get(to)!.set(from, weight);
  }
  return map;
}

/** Dijkstra for the demo's small undirected maps. Zero-cost paths are supported. */
export function shortestRoute(graph: RoutingGraph): RouteResult | null {
  const map = adjacency(graph);
  const distances = new Map(graph.nodes.map((node) => [node, Infinity]));
  const previous = new Map<string, string>();
  const unvisited = new Set(graph.nodes);
  distances.set(graph.start, 0);
  while (unvisited.size) {
    let current: string | undefined;
    for (const node of unvisited) {
      if (
        current === undefined ||
        distances.get(node)! < distances.get(current)!
      )
        current = node;
    }
    if (current === undefined || !Number.isFinite(distances.get(current)!))
      break;
    if (current === graph.end) {
      const path = [current];
      while (previous.has(path[0]!)) path.unshift(previous.get(path[0]!)!);
      return { path, cost: distances.get(current)! };
    }
    unvisited.delete(current);
    for (const [neighbor, weight] of map.get(current)!) {
      if (!unvisited.has(neighbor)) continue;
      const candidate = distances.get(current)! + weight;
      if (!Number.isFinite(candidate))
        throw new RangeError("Route cost exceeds the supported numeric range.");
      if (candidate < distances.get(neighbor)!) {
        distances.set(neighbor, candidate);
        previous.set(neighbor, current);
      }
    }
  }
  return null;
}

export function validateRoute(
  graph: RoutingGraph,
  path: string[],
): RouteValidation {
  const map = adjacency(graph);
  const best = shortestRoute(graph);
  const invalid = (feedback: string): RouteValidation => ({
    valid: false,
    optimal: false,
    cost: null,
    optimalCost: best?.cost ?? null,
    feedback,
  });
  if (path[0] !== graph.start) return invalid(`Start at ${graph.start}.`);
  if (path[path.length - 1] !== graph.end)
    return invalid(`Your route must finish at ${graph.end}.`);
  let cost = 0;
  for (let index = 0; index < path.length; index++) {
    if (!map.has(path[index]!))
      return invalid("Your route includes an unknown location.");
    if (index === 0) continue;
    const edge = map.get(path[index - 1]!)!.get(path[index]!);
    if (edge === undefined)
      return invalid(
        `There is no path from ${path[index - 1]} to ${path[index]}.`,
      );
    cost += edge;
    if (!Number.isFinite(cost))
      return invalid("This route is too costly to calculate.");
  }
  const tolerance = 1e-9 * Math.max(1, cost, best?.cost ?? 0);
  const optimal = best !== null && Math.abs(cost - best.cost) <= tolerance;
  return {
    valid: true,
    optimal,
    cost,
    optimalCost: best?.cost ?? null,
    feedback: optimal
      ? `You reached ${graph.end} with the lowest total cost: ${cost}. The total of the path weights determines the best route.`
      : `This route reaches ${graph.end} at a cost of ${cost}. A route with a smaller total exists; compare sums, not just the number of stops.`,
  };
}
