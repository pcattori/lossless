import * as RR from "./react-router"

type Params = {
  id: string
}

export type ServerLoader = RR.ServerLoader<Params>
import type { serverLoader } from "./product-details"
type ServerLoaderData = Awaited<ReturnType<typeof serverLoader>>
// type ServerLoaderData = undefined

export type ClientLoader = RR.ClientLoader<Params, ServerLoaderData>
import type { clientLoader } from "./product-details"
type ClientLoaderData = Awaited<ReturnType<typeof clientLoader>>
// type ClientLoaderData = undefined

type ClientLoaderHydrate = true

export type HydrateFallback = RR.HydrateFallback<Params>
// import type { HydrateFallback as HF } from "./product-details"
type HF = undefined

type LoaderData = RR.LoaderData<
  ServerLoaderData,
  ClientLoaderData,
  ClientLoaderHydrate,
  HydrateFallback
>

export type Component = RR.Component<Params, LoaderData>
