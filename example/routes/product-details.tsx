export const serverLoader = () => 1

export const clientLoader = () => 1

export default ({ params, loaderData }) => {
  let a: string = loaderData
  return `Hello, ${params.id}!`
}
