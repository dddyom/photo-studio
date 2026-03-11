import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  clients,
  pricing,
  type Client,
  type CreateClientInput,
  type UpdateClientInput,
  type PricingProgram,
} from "@/infrastructure/tauri-bridge";

export function ClientsPage() {
  const { data, loading, refetch } = useTauriCommand(clients.listAll);
  const { data: programs } = useTauriCommand(pricing.listPrograms);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activePrograms = (programs ?? []).filter((p) => p.is_active);

  const handleArchive = async (c: Client) => {
    if (!confirm(`Архивировать клиента "${c.name}"?`)) return;
    try {
      await clients.archive(c.id);
      toast.success("Клиент архивирован");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUnarchive = async (c: Client) => {
    try {
      await clients.unarchive(c.id);
      toast.success("Клиент восстановлен из архива");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDelete = async (c: Client) => {
    if (!confirm(`Удалить клиента "${c.name}" навсегда?`)) return;
    try {
      await clients.delete(c.id);
      toast.success("Клиент удалён");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const filtered = (data ?? []).filter((c) => showArchived || !c.is_archived);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Клиенты</h1>
        <button
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          onClick={() => {
            setShowForm(!showForm);
            setEditingClient(null);
          }}
        >
          {showForm && !editingClient ? "Отмена" : "+ Добавить"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Показать архивных
        </label>
      </div>

      {showForm && !editingClient && (
        <CreateClientForm
          programs={activePrograms}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {editingClient && (
        <EditClientForm
          client={editingClient}
          programs={activePrograms}
          onSaved={() => {
            setEditingClient(null);
            refetch();
          }}
          onCancel={() => setEditingClient(null)}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-md p-5">
        {loading ? (
          <p className="text-gray-500">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Нет клиентов</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Имя
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Телефон
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Email
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Прайс
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Создан
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    programs={programs ?? []}
                    onEdit={() => {
                      setEditingClient(c);
                      setShowForm(false);
                    }}
                    onArchive={() => handleArchive(c)}
                    onUnarchive={() => handleUnarchive(c)}
                    onDelete={() => handleDelete(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({
  client: c,
  programs,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  client: Client;
  programs: PricingProgram[];
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const programName = c.default_pricing_program_id
    ? programs.find((p) => p.id === c.default_pricing_program_id)?.name ?? "—"
    : "—";

  return (
    <tr className={`border-b border-gray-100 last:border-0 ${c.is_archived ? "opacity-50" : ""}`}>
      <td className="px-3 py-2.5">
        {c.name}
        {c.is_archived && <span className="ml-2 text-xs text-gray-400">(архив)</span>}
      </td>
      <td className="px-3 py-2.5">{c.phone ?? "—"}</td>
      <td className="px-3 py-2.5">{c.email ?? "—"}</td>
      <td className="px-3 py-2.5 text-sm text-gray-500">{programName}</td>
      <td className="px-3 py-2.5 text-gray-500">
        {new Date(c.created_at).toLocaleDateString("ru")}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {c.is_archived ? (
          <>
            <button
              onClick={onUnarchive}
              className="text-xs text-blue-600 hover:text-blue-700 mr-3"
            >
              Восстановить
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Удалить
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:text-blue-700 mr-3"
            >
              Изменить
            </button>
            <button
              onClick={onArchive}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Архив
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function CreateClientForm({
  programs,
  onCreated,
}: {
  programs: PricingProgram[];
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClientInput>();

  const onSubmit = async (input: CreateClientInput) => {
    try {
      const payload = {
        ...input,
        default_pricing_program_id: input.default_pricing_program_id || null,
      };
      await clients.create(payload);
      toast.success("Клиент добавлен");
      reset();
      onCreated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const inputCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Имя *</label>
          <input {...register("name", { required: true })} placeholder="Имя клиента" className={inputCls} />
          {errors.name && <p className="text-red-600 text-xs mt-0.5">Обязательное поле</p>}
        </div>
        <div className="min-w-[150px] w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          <input {...register("phone")} placeholder="+7 ..." className={inputCls} />
        </div>
        <div className="min-w-[180px] w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input {...register("email")} placeholder="email@example.com" className={inputCls} />
        </div>
        <div className="min-w-[160px] w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Прайс</label>
          <select {...register("default_pricing_program_id", { valueAsNumber: true })} className={inputCls}>
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
          <input {...register("notes")} placeholder="Заметки" className={inputCls} />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          Сохранить
        </button>
      </form>
    </div>
  );
}

function EditClientForm({
  client,
  programs,
  onSaved,
  onCancel,
}: {
  client: Client;
  programs: PricingProgram[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<UpdateClientInput>({
    defaultValues: {
      name: client.name,
      phone: client.phone,
      email: client.email,
      default_pricing_program_id: client.default_pricing_program_id,
      notes: client.notes,
    },
  });

  const onSubmit = async (input: UpdateClientInput) => {
    try {
      const payload = {
        ...input,
        default_pricing_program_id: input.default_pricing_program_id || null,
      };
      await clients.update(client.id, payload);
      toast.success("Клиент обновлён");
      onSaved();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const inputCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="bg-white border border-blue-200 rounded-md p-4 mb-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <div className="text-xs font-medium text-blue-600 w-full -mb-1">Редактирование: {client.name}</div>
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
          <input {...register("name")} className={inputCls} />
        </div>
        <div className="min-w-[150px] w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          <input {...register("phone")} className={inputCls} />
        </div>
        <div className="min-w-[180px] w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input {...register("email")} className={inputCls} />
        </div>
        <div className="min-w-[160px] w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Прайс</label>
          <select {...register("default_pricing_program_id", { valueAsNumber: true })} className={inputCls}>
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
          <input {...register("notes")} className={inputCls} />
        </div>
        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap">
          Сохранить
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors whitespace-nowrap">
          Отмена
        </button>
      </form>
    </div>
  );
}
