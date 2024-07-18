export type Edit = [index: number, addition: string]

type TextWithEdits = {
  original: string
  edits: Edit[]
  edited: string
}
export type Type = TextWithEdits

export function make({
  original,
  edits,
}: Omit<TextWithEdits, "edited">): TextWithEdits {
  let chars = Array.from(original)

  // iterate over additions in reverse so that splicing doesn't mess up other indices
  for (let [index, addition] of reverse(edits)) {
    chars.splice(index, 0, addition)
  }

  let edited = chars.join("")
  return { original, edits, edited }
}

export function toEditedIndex(
  { edits }: TextWithEdits,
  originalIndex: number,
): number {
  let editOffset = 0
  for (let [index, addition] of edits) {
    if (index > originalIndex) break
    editOffset += addition.length
  }
  return originalIndex + editOffset
}

export function toOriginalIndex(
  { edits }: TextWithEdits,
  editedIndex: number,
): number {
  let originalIndex = editedIndex
  let editOffset = 0
  for (let [index, addition] of edits) {
    // before this addition
    if (editedIndex < index + editOffset) break

    // within this addition
    if (editedIndex < index + editOffset + addition.length) return index

    // after this addition
    originalIndex -= addition.length
    editOffset += addition.length
  }
  return Math.max(0, originalIndex)
}

function* reverse<T>(array: T[]): Generator<T> {
  let i = array.length - 1
  while (i >= 0) {
    yield array[i]!
    i--
  }
}
