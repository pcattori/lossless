import type { LinkDescriptor } from "./links"
import type { ReactNode } from "react"

export type { LinkDescriptor }

// prettier-ignore
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
type IsAny<T> = 0 extends 1 & T ? true : false
type Fn = (...args: any[]) => unknown
type MaybePromise<T> = T | Promise<T>

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

type ServerData = MaybePromise<
  Exclude<Serializable, undefined | Promise<Serializable>>
>

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

// prettier-ignore
type DataFrom<T> =
  IsAny<T> extends true ? undefined :
  T extends Fn ? Awaited<ReturnType<T>> :
  undefined

export type RouteArgs<
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
  links: { params: Params }
  serverLoader: LoaderArgs<Params>
  clientLoader: LoaderArgs<Params> & {
    serverLoader: () => Promise<DataFrom<RouteModule["serverLoader"]>>
  }

  // TODO: clientLoader.hydrate
  HydrateFallback: { params: Params }

  serverAction: ActionArgs<Params>
  clientAction: LoaderArgs<Params> & {
    serverLoader: () => Promise<DataFrom<RouteModule["serverAction"]>>
  }
  default: {
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
  }
  ErrorBoundary: {
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
  }
}
