import { Suspense } from "react";
import { CatalogueScreen } from "../components/CatalogueScreen";
export default function ShopPage(){return <Suspense fallback={<div className="catalogue-route-fallback">Loading catalogue…</div>}><CatalogueScreen mode="shop"/></Suspense>}
