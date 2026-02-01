export function calculateGridArea(
  positions: string,
  cols: number
): {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
} {
  const nums = positions.split(',').map(Number)
  const coords = nums.map((n) => ({
    row: Math.floor((n - 1) / cols) + 1,
    col: ((n - 1) % cols) + 1,
  }))

  return {
    rowStart: Math.min(...coords.map((c) => c.row)),
    rowEnd: Math.max(...coords.map((c) => c.row)) + 1,
    colStart: Math.min(...coords.map((c) => c.col)),
    colEnd: Math.max(...coords.map((c) => c.col)) + 1,
  }
}
