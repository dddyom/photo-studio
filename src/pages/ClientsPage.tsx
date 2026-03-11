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
  const { data, loading, refetch } = useTauriCommand(clients.list);
  const { data: programs } = useTauriCommand(pricing.listPrograms);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activePrograms = (programs ?? []).filter((p) => p.is_active);

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
        ) : !data || data.length === 0 ? (
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
                {data
                  .filter((c) => showArchived || !c.is_archived)
                  .map((c) => (
                    <ClientRow
                      key={c.id}
                      client={c}
                      programs={programs ?? []}
                      onEdit={() => {
                        setEditingClient(c);
                        setShowForm(false);
                      }}
                      onArchive={async () => {
                        if (!confirm(`Архивировать клиента "${c.name}"?`)) return;
                        try {
                          await clients.archive(c.id);
                          toast.success("Клиент архивирован");
                          refetch();
                        } catch (err) {
                          toast.error(String(err));
                        }
                      }}
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
}: {
  client: Client;
  programs: PricingProgram[];
  onEdit: () => void;
  onArchive: () => void;
}) {
  const programName = c.default_pricing_program_id
    ? programs.find((p) => p.id === c.default_pricing_program_id)?.name ?? "—"
    : "—";

  return (
    <tr className={`border-b border-gray-100 last:border-0 ${c.is_archived ? "opacity-50" : ""}`}>
      <td className="px-3 py-2.5">{c.name}</td>
      <td className="px-3 py-2.5">{c.phone ?? "—"}</td>
      <td className="px-3 py-2.5">{c.email ?? "—"}</td>
      <td className="px-3 py-2.5 text-sm text-gray-500">{programName}</td>
      <td className="px-3 py-2.5 text-gray-500">
        {new Date(c.created_at).toLocaleDateString("ru")}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          onClick={onEdit}
          className="text-xs text-blue-600 hover:text-blue-700 mr-3"
        >
          Изменить
        </button>
        {!c.is_archived && (
          <button
            onClick={onArchive}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Архив
          </button>
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

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
      <h2 className="text-base font-semibold mb-3">Новый клиент</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Имя *</label>
          <input
            {...register("name", { required: "Обязательное поле" })}
            placeholder="Имя клиента"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          {errors.name && (
            <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Телефон</label>
          <input
            {...register("phone")}
            placeholder="+7 ..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register("email")}
            placeholder="email@example.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Прайс-программа</label>
          <select
            {...register("default_pricing_program_id", { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          >
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Заметки</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
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

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
      <h2 className="text-base font-semibold mb-3">
        Редактирование: {client.name}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Имя</label>
          <input
            {...register("name")}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Телефон</label>
          <input
            {...register("phone")}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register("email")}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Прайс-программа</label>
          <select
            {...register("default_pricing_program_id", { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          >
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Заметки</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
