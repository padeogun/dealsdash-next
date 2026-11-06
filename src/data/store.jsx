// App-wide data. One provider loads a workspace's collections and exposes save and remove.
// The backend is swapped by build flag: the demo build never includes Firebase.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
export const COLLECTIONS = ["deals", "movements", "contacts", "facilities"];
export function StoreProvider({ adapter, user, children }) {
  const [ws, setWs] = useState(null), [data, setData] = useState({ deals: [], movements: [], contacts: [], facilities: [] }), [error, setError] = useState(null);
  useEffect(() => {
    const offs = [adapter.onWorkspace(setWs, setError), ...COLLECTIONS.map((c) => adapter.onCollection(c, (rows) => setData((d) => ({ ...d, [c]: rows })), setError))];
    return () => offs.forEach((o) => o && o());
  }, [adapter]);
  const api = useMemo(() => ({ ws, ...data, user, error, adapter,
    saveWorkspace: (patch) => adapter.saveWorkspace(patch).catch(setError),
    save: (c, doc) => adapter.save(c, doc).catch(setError),
    remove: (c, id) => adapter.remove(c, id).catch(setError) }), [ws, data, user, error, adapter]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
