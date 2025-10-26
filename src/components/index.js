import withEnvironmentPrefix from "./EnvironmentComponentWrapper";
import Transaksi from "./Transaksi";
import SimpanPinjam from "./SimpanPinjam";
import DaftarAnggotaBaru from "./DaftarAnggotaBaru";
import Stocks from "./Stocks";
import WarehouseStock from "./WarehouseStock";
import SejarahBelanja from "./SejarahBelanja";
import SejarahBelanjaWarehouse from "./SejarahBelanjaWarehouse";
import WarehouseExit from "./WarehouseExit";
import SejarahTransaksi from "./SejarahTransaksi";
import SejarahTransaksiWarehouse from "./SejarahTransaksiWarehouse";
import NotaBelanjaB2B from "./NotaBelanjaB2B";
import AdminPanel from "./AdminPanel";
import AdminSettings from "./AdminSettings";
import LoginTailwind from "./LoginTailwind";

// Wrap all components with the environment prefix HOC
export const TransaksiWithEnv = withEnvironmentPrefix(Transaksi);
export const SimpanPinjamWithEnv = withEnvironmentPrefix(SimpanPinjam);
export const DaftarAnggotaBaruWithEnv =
  withEnvironmentPrefix(DaftarAnggotaBaru);
export const StocksWithEnv = withEnvironmentPrefix(Stocks);
export const WarehouseStockWithEnv = withEnvironmentPrefix(WarehouseStock);
export const SejarahBelanjaWithEnv = withEnvironmentPrefix(SejarahBelanja);
export const SejarahBelanjaWarehouseWithEnv = withEnvironmentPrefix(
  SejarahBelanjaWarehouse
);
export const WarehouseExitWithEnv = withEnvironmentPrefix(WarehouseExit);
export const SejarahTransaksiWithEnv = withEnvironmentPrefix(SejarahTransaksi);
export const SejarahTransaksiWarehouseWithEnv = withEnvironmentPrefix(
  SejarahTransaksiWarehouse
);
export const NotaBelanjaB2BWithEnv = withEnvironmentPrefix(NotaBelanjaB2B);
export const AdminPanelWithEnv = withEnvironmentPrefix(AdminPanel);
// Don't wrap AdminSettings since it's used to control the environment
export { AdminSettings };

// Export the Tailwind version of Login
export { LoginTailwind };

// Re-export LoginTailwind as Login for backward compatibility
export { LoginTailwind as Login };
