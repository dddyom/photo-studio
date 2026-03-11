import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { system } from "@/infrastructure/tauri-bridge";

export function DashboardPage() {
  const { data: dbInfo, loading } = useTauriCommand(system.getDbInfo);
  const { data: settings } = useTauriCommand(system.getSettings);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{settings?.company_name ?? "..."}</h1>
        <p className="text-gray-500 mt-1">Главная панель</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
        <h2 className="text-base font-semibold mb-3">Статус системы</h2>
        {loading ? (
          <p className="text-gray-500">Загрузка...</p>
        ) : dbInfo ? (
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-500 w-40">База данных</td>
                <td className="py-2 break-all">{dbInfo.path}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-500">Версия схемы</td>
                <td className="py-2">{dbInfo.version}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-gray-500">Размер файла</td>
                <td className="py-2">{(dbInfo.size_bytes / 1024).toFixed(1)} КБ</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-5">
        <h2 className="text-base font-semibold mb-3">Быстрые действия</h2>
        <div className="flex gap-3">
          <a
            href="/orders"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Новый заказ
          </a>
          <a
            href="/clients"
            className="inline-flex items-center px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Клиенты
          </a>
          <a
            href="/finance"
            className="inline-flex items-center px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Финансы
          </a>
        </div>
      </div>
    </div>
  );
}
