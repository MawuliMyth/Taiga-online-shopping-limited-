import { Suspense } from "react";
import { CatalogueScreen } from "../components/CatalogueScreen";
export default function SearchPage(){return <Suspense fallback={<div className="catalogue-route-fallback">Loading search…</div>}><CatalogueScreen mode="search"/></Suspense>}
