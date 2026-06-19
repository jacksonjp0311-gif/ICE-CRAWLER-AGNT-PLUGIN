/**
 * engine/phi-partition.js
 * Golden-ratio (φ) partitioner for φ-extremal agentic task splitting
 * Ported from Python: agentics/phi_partition.py
 */

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const INVERSE_GOLDEN_RATIO = 1 / GOLDEN_RATIO;

/**
 * Find the split index where cumulative size exceeds target
 */
function splitIndex(sizes, target) {
  let accum = 0;
  for (let i = 0; i < sizes.length; i++) {
    if (accum + sizes[i] > target && i > 0) {
      return i;
    }
    accum += sizes[i];
  }
  return Math.max(1, Math.floor(sizes.length / 2));
}

/**
 * Recursive partition using golden-ratio split
 */
function partitionRecursive(items, sizes, maxSize, depth) {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total <= maxSize || items.length <= 1) {
    return [{ items: [...items], totalSize: total, depth }];
  }

  const target = total * INVERSE_GOLDEN_RATIO;
  const splitAt = splitIndex(sizes, target);

  const leftItems = items.slice(0, splitAt);
  const rightItems = items.slice(splitAt);
  const leftSizes = sizes.slice(0, splitAt);
  const rightSizes = sizes.slice(splitAt);

  const partitions = [];
  for (const [subItems, subSizes] of [[leftItems, leftSizes], [rightItems, rightSizes]]) {
    if (subItems.length === 0) continue;
    partitions.push(...partitionRecursive(subItems, subSizes, maxSize, depth + 1));
  }
  return partitions;
}

/**
 * Partition items using golden-ratio split until partitions fit max_size
 * @param {Array} items - Items to partition (each must have a size property)
 * @param {string} sizeKey - Key for size property
 * @param {number} maxSize - Maximum total size per partition
 * @param {string} sortKey - Key to sort by before partitioning
 * @returns {{ partitions: Array, oversize: Array }}
 */
export function phiPartition(items, sizeKey = 'size_kb', maxSize = 512, sortKey = 'path') {
  const normalized = [...items].sort((a, b) => {
    const aKey = a[sortKey] || '';
    const bKey = b[sortKey] || '';
    return aKey.localeCompare(bKey);
  });

  const oversize = normalized.filter(item => (item[sizeKey] || 0) > maxSize);
  const fittable = normalized.filter(item => (item[sizeKey] || 0) <= maxSize);

  const sizes = fittable.map(item => item[sizeKey] || 0);
  const partitions = partitionRecursive(fittable, sizes, maxSize, 0);

  return {
    partitions: partitions.map(p => ({
      items: p.items,
      totalSize: Math.round(p.totalSize * 1000) / 1000,
      depth: p.depth,
    })),
    oversize,
  };
}

export { GOLDEN_RATIO, INVERSE_GOLDEN_RATIO };
export default { phiPartition, GOLDEN_RATIO, INVERSE_GOLDEN_RATIO };
