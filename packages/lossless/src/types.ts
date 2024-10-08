import type { ReactNode } from "react"

import type { LinkDescriptor } from "./links"

// prettier-ignore
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
type IsAny<T> = 0 extends 1 & T ? true : false
type Fn = (...args: any[]) => unknown

type IsDefined<T> = Equal<T, undefined> extends true ? false : true

export interface AppLoadContext {}

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

// prettier-ignore
type Serialize<T> =
  // First, let type stay as-is if its already serializable...
  T extends Serializable ? T :

  // ...then don't allow functions to be serialized...
  T extends (...args: any[]) => unknown ? undefined :

  // ...lastly handle inner types for all container types allowed by `turbo-stream`

  // Promise
  T extends Promise<infer U> ? Promise<Serialize<U>> :

  // Map & Set
  T extends Map<infer K, infer V> ? Map<Serialize<K>, Serialize<V>> :
  T extends Set<infer U> ? Set<Serialize<U>> :

  // Array
  T extends [] ? [] :
  T extends readonly [infer F, ...infer R] ? [Serialize<F>, ...Serialize<R>] :
  T extends Array<infer U> ? Array<Serialize<U>> :
  T extends readonly unknown[] ? readonly Serialize<T[number]>[] :

  // Record
  T extends Record<any, any> ? {[K in keyof T]: Serialize<T[K]>} :

  undefined

// prettier-ignore
type DataFrom<T> =
  IsAny<T> extends true ? undefined :
  T extends Fn ? Serialize<VoidToUndefined<Awaited<ReturnType<T>>>> :
  undefined

type VoidToUndefined<T> = Equal<T, void> extends true ? undefined : T

// prettier-ignore
type LoaderData<
  ServerLoaderData,
  ClientLoaderData,
  ClientLoaderHydrate extends boolean,
  HasHydrateFallback
> =
  [HasHydrateFallback, ClientLoaderHydrate]  extends [true, true] ?
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

// prettier-ignore
type ActionData<ServerActionData, ClientActionData> = Awaited<
  [IsDefined<ServerActionData>, IsDefined<ClientActionData>] extends [true, true] ? ServerActionData | ClientActionData :
  IsDefined<ClientActionData> extends true ? ClientActionData :
  IsDefined<ServerActionData> extends true ? ServerActionData :
  undefined
>

type LoaderArgs<Params> = {
  context: AppLoadContext
  request: Request
  params: Params
}

type ActionArgs<Params> = {
  context: AppLoadContext
  request: Request
  params: Params
}

export type Route<
  Params,
  RouteModule extends {
    serverLoader?: Fn
    clientLoader?: Fn
    serverAction?: Fn
    clientAction?: Fn
    HydrateFallback?: Fn
  },
> = {
  // TODO: meta, handle, shouldRevalidate
  links: (args: { params: Params }) => LinkDescriptor[]
  serverLoader: (args: LoaderArgs<Params>) => unknown
  clientLoader: (
    args: LoaderArgs<Params> & {
      serverLoader: () => Promise<DataFrom<RouteModule["serverLoader"]>>
    },
  ) => unknown

  // TODO: clientLoader.hydrate
  HydrateFallback: (args: { params: Params }) => ReactNode

  serverAction: (args: ActionArgs<Params>) => unknown
  clientAction: (
    args: LoaderArgs<Params> & {
      serverLoader: () => Promise<DataFrom<RouteModule["serverAction"]>>
    },
  ) => unknown
  default: (args: {
    params: Params
    loaderData: LoaderData<
      DataFrom<RouteModule["serverLoader"]>,
      DataFrom<RouteModule["clientLoader"]>,
      false, // TODO
      IsAny<RouteModule["HydrateFallback"]> extends true ? false : true
    >
    actionData?: ActionData<
      DataFrom<RouteModule["serverAction"]>,
      DataFrom<RouteModule["clientAction"]>
    >
  }) => ReactNode
  ErrorBoundary: (args: {
    params: Params
    error: unknown
    loaderData?: LoaderData<
      DataFrom<RouteModule["serverLoader"]>,
      DataFrom<RouteModule["clientLoader"]>,
      false, // TODO
      IsAny<RouteModule["HydrateFallback"]> extends true ? false : true
    >
    actionData?: ActionData<
      DataFrom<RouteModule["serverAction"]>,
      DataFrom<RouteModule["clientAction"]>
    >
  }) => ReactNode
}
