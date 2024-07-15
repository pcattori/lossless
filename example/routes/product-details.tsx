export const serverLoader = () => 1

export const clientLoader = () => 1

export default ({ params }) => {
  return `Hello, ${params.id}!`
}
