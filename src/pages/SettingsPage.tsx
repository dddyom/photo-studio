import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { system, type BackupInfo } from "@/infrastructure/tauri-bridge";

export function SettingsPage() {
  const { data: settings, refetch } = useTauriCommand(system.getSettings);
  const { data: dbInfo } = useTauriCommand(system.getDbInfo);
  const { data: backups, refetch: refetchBackups } = useTauriCommand(
    useCallback(() => system.listBackups(), []),
    []
  );
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (settings) setCompanyName(settings.company_name);
  }, [settings]);

  const handleSave = async () => {
    try {
      await system.updateSetting("company_name", companyName);
      toast.success("Настройки сохранены");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleCreateBackup = async () => {
    try {
      const info = await system.createBackup();
      toast.success(`Backup создан: ${info.filename}`);
      refetchBackups();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleRestore = async (backup: BackupInfo) => {
    if (!confirm(`Восстановить базу данных из "${backup.filename}"?\n\nТекущие данные будут заменены. Рекомендуется сначала сделать backup текущих данных.\n\nПосле восстановления потребуется перезапуск приложения.`)) return;
    try {
      const msg = await system.restoreBackup(backup.filename);
      toast.success(msg);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Удалить backup "${filename}"?`)) return;
    try {
      await system.deleteBackup(filename);
      toast.success("Backup удалён");
      refetchBackups();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleExport = async (type: "orders" | "transactions" | "partners") => {
    try {
      let path: string;
      switch (type) {
        case "orders":
          path = await system.exportOrdersCsv();
          break;
        case "transactions":
          path = await system.exportTransactionsCsv();
          break;
        case "partners":
          path = await system.exportPartnerSettlementsCsv();
          break;
      }
      toast.success(`Экспорт сохранён:\n${path}`, { duration: 5000 });
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Настройки</h1>
      </div>

      {/* Company */}
      <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
        <h2 className="text-base font-semibold mb-3">Компания</h2>
        <div className="max-w-md mb-4">
          <label className="block text-sm font-medium mb-1">Название компании</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <button
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          onClick={handleSave}
        >
          Сохранить
        </button>
      </div>

      {/* Database */}
      <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
        <h2 className="text-base font-semibold mb-3">База данных</h2>
        {dbInfo && (
          <table className="w-full mb-4">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-500 w-40">Расположение</td>
                <td className="py-2 break-all text-sm font-mono">{dbInfo.path}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-500">Версия схемы</td>
                <td className="py-2">{dbInfo.version}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-gray-500">Размер</td>
                <td className="py-2">{(dbInfo.size_bytes / 1024).toFixed(1)} КБ</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Backup / Restore */}
      <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Резервные копии</h2>
          <button
            onClick={handleCreateBackup}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Создать backup
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Backups хранятся в папке <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">backups/</code> рядом с файлом базы данных.
        </p>

        {(!backups || backups.length === 0) ? (
          <p className="text-gray-400 text-sm py-4 text-center">Нет резервных копий</p>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Файл</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Размер</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Дата</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{b.filename}</td>
                    <td className="px-3 py-2 text-gray-600">{(b.size_bytes / 1024).toFixed(1)} КБ</td>
                    <td className="px-3 py-2 text-gray-600">{b.created_at}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRestore(b)}
                        className="text-xs text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Восстановить
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(b.filename)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
        <h2 className="text-base font-semibold mb-3">Экспорт данных (CSV)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Файлы сохраняются в папку <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">exports/</code> рядом с файлом базы данных. CSV совместим с Excel и Google Sheets.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExport("orders")}
            className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Заказы
          </button>
          <button
            onClick={() => handleExport("transactions")}
            className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Финансовые операции
          </button>
          <button
            onClick={() => handleExport("partners")}
            className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Расчёты с партнёрами
          </button>
        </div>
      </div>
    </div>
  );
}
