import type { ReactNode } from "react"

// prettier-ignore
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

type MaybePromise<T> = T | Promise<T>
type IsDefined<T> = Equal<T, undefined> extends true ? false : true

interface AppLoadContext {}

type ResponseStub = {
  status: number | undefined
  headers: Headers
}

type Serializable =
  | undefined
  | null
  | boolean
  | string
  | symbol
  | number
  | Array<Serializable>
  | { [key: PropertyKey]: Serializable }
  | bigint
  | Date
  | URL
  | RegExp
  | Error
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | Promise<Serializable>

type ServerData = MaybePromise<
  Exclude<Serializable, undefined | Promise<Serializable>>
>

type LoaderArgs<Params> = {
  context: AppLoadContext
  request: Request
  params: Params
  response: ResponseStub
}

export type ServerLoader<Params> = (args: LoaderArgs<Params>) => ServerData

export type ClientLoader<Params, ServerLoaderData> = (
  args: LoaderArgs<Params> & {
    serverLoader: () => Promise<ServerLoaderData>
  },
) => unknown

export type HydrateFallback<Params> = (args: { params: Params }) => ReactNode

// prettier-ignore
export type LoaderData<
  ServerLoaderData,
  ClientLoaderData,
  ClientLoaderHydrate extends boolean,
  ClientLoaderFallback,
> =
  [undefined extends ClientLoaderFallback ? false : true, ClientLoaderHydrate]  extends [true, true] ?
    IsDefined<ClientLoaderData> extends true ? ClientLoaderData :
    undefined
  :
  [IsDefined<ClientLoaderData>, IsDefined<ServerLoaderData>] extends [true, true] ? ServerLoaderData | ClientLoaderData :
  IsDefined<ClientLoaderData> extends true ?
    ClientLoaderHydrate extends true ? ClientLoaderData :
    ClientLoaderData | undefined
  :
  IsDefined<ServerLoaderData> extends true ? ServerLoaderData :
  undefined

export type Component<Params, LoaderData> = (args: {
  params: Params
  loaderData: LoaderData
  // TODO: actionData
}) => ReactNode
