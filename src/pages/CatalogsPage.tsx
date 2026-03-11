import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  type CatalogItem,
  type MaterialItem,
  type ExtraOptionType,
  type CreateCatalogInput,
  type UpdateCatalogInput,
  type CreateMaterialInput,
  type CreateExtraOptionInput,
  type UpdateExtraOptionInput,
} from "@/infrastructure/tauri-bridge";

interface CatalogDef {
  key: string;
  label: string;
  type: "simple" | "material" | "extra";
}

const CATALOG_DEFS: CatalogDef[] = [
  { key: "book_formats", label: "Форматы фотокниг", type: "simple" },
  { key: "print_formats", label: "Форматы печати", type: "simple" },
  { key: "cover_types", label: "Типы обложек", type: "simple" },
  { key: "cover_materials", label: "Материалы обложек", type: "simple" },
  { key: "lamination_types", label: "Типы ламинации", type: "simple" },
  { key: "materials", label: "Материалы", type: "material" },
  { key: "extra_option_types", label: "Доп. опции", type: "extra" },
];

const CATALOG_COMMANDS: Record<string, {
  listAll: () => Promise<CatalogItem[]>;
  create: (input: CreateCatalogInput) => Promise<CatalogItem>;
  update: (id: number, input: UpdateCatalogInput) => Promise<CatalogItem>;
}> = {
  book_formats: { listAll: catalogs.allBookFormats, create: catalogs.createBookFormat, update: catalogs.updateBookFormat },
  print_formats: { listAll: catalogs.allPrintFormats, create: catalogs.createPrintFormat, update: catalogs.updatePrintFormat },
  cover_types: { listAll: catalogs.allCoverTypes, create: catalogs.createCoverType, update: catalogs.updateCoverType },
  cover_materials: { listAll: catalogs.allCoverMaterials, create: catalogs.createCoverMaterial, update: catalogs.updateCoverMaterial },
  lamination_types: { listAll: catalogs.allLaminationTypes, create: catalogs.createLaminationType, update: catalogs.updateLaminationType },
};

export function CatalogsPage() {
  const [activeTab, setActiveTab] = useState("book_formats");
  const activeDef = CATALOG_DEFS.find((d) => d.key === activeTab)!;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-gray-500 text-sm mt-1">
          Форматы, материалы, типы обложек и другие справочные данные
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {CATALOG_DEFS.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveTab(d.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === d.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {activeDef.type === "simple" && (
        <SimpleCatalogEditor catalogKey={activeTab} />
      )}
      {activeDef.type === "material" && <MaterialsEditor />}
      {activeDef.type === "extra" && <ExtraOptionsEditor />}
    </div>
  );
}

function SimpleCatalogEditor({ catalogKey }: { catalogKey: string }) {
  const cmds = CATALOG_COMMANDS[catalogKey];
  const { data, refetch } = useTauriCommand(cmds.listAll, [catalogKey]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await cmds.create({ name: newName.trim() });
      toast.success("Добавлено");
      setNewName("");
      setShowAdd(false);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await cmds.update(id, { name: editName.trim() });
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleToggle = async (item: CatalogItem) => {
    try {
      await cmds.update(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{data?.length ?? 0} записей</span>
        <button
          className="text-blue-600 text-sm hover:text-blue-700"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {!data || data.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Пусто</div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between">
              {editingId === item.id ? (
                <div className="flex-1 flex gap-2 mr-4">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)}
                    autoFocus
                  />
                  <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                </div>
              ) : (
                <span
                  className={`text-sm cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                  onClick={() => { setEditingId(item.id); setEditName(item.name); }}
                >
                  {item.name}
                </span>
              )}
              <button
                onClick={() => handleToggle(item)}
                className={`text-xs px-2 py-0.5 rounded ${
                  item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {item.is_active ? "Активно" : "Неактивно"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const MATERIAL_CATEGORIES = [
  { value: "block", label: "Блок" },
  { value: "print", label: "Печать" },
  { value: "finishing", label: "Отделка" },
];

function MaterialsEditor() {
  const { data, refetch } = useTauriCommand(catalogs.allMaterials);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("block");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await catalogs.createMaterial({ name: newName.trim(), category: newCategory } as CreateMaterialInput);
      toast.success("Добавлено");
      setNewName("");
      setShowAdd(false);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await catalogs.updateMaterial(id, { name: editName.trim() });
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleToggle = async (item: MaterialItem) => {
    try {
      await catalogs.updateMaterial(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const grouped = (data ?? []).reduce(
    (acc, m) => {
      (acc[m.category] = acc[m.category] || []).push(m);
      return acc;
    },
    {} as Record<string, MaterialItem[]>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{data?.length ?? 0} материалов</span>
        <button
          className="text-blue-600 text-sm hover:text-blue-700"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded text-sm"
          >
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {MATERIAL_CATEGORIES.map((cat) => {
          const items = grouped[cat.value] ?? [];
          if (items.length === 0 && !showAdd) return null;
          return (
            <div key={cat.value}>
              <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                {cat.label}
              </div>
              {items.map((item) => (
                <div key={item.id} className="px-5 py-2.5 flex items-center justify-between">
                  {editingId === item.id ? (
                    <div className="flex-1 flex gap-2 mr-4">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                    </div>
                  ) : (
                    <span
                      className={`text-sm cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                      onClick={() => { setEditingId(item.id); setEditName(item.name); }}
                    >
                      {item.name}
                    </span>
                  )}
                  <button
                    onClick={() => handleToggle(item)}
                    className={`text-xs px-2 py-0.5 rounded ${
                      item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.is_active ? "Активно" : "Неактивно"}
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtraOptionsEditor() {
  const { data, refetch } = useTauriCommand(catalogs.allExtraOptionTypes);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const input: CreateExtraOptionInput = {
        name: newName.trim(),
        default_price: newPrice ? parseFloat(newPrice) : undefined,
      };
      await catalogs.createExtraOptionType(input);
      toast.success("Добавлено");
      setNewName("");
      setNewPrice("");
      setShowAdd(false);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const input: UpdateExtraOptionInput = {
        name: editName.trim() || undefined,
        default_price: editPrice ? parseFloat(editPrice) : undefined,
      };
      await catalogs.updateExtraOptionType(id, input);
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleToggle = async (item: ExtraOptionType) => {
    try {
      await catalogs.updateExtraOptionType(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{data?.length ?? 0} опций</span>
        <button
          className="text-blue-600 text-sm hover:text-blue-700"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Цена по умолч."
            className="w-32 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {!data || data.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Пусто</div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between">
              {editingId === item.id ? (
                <div className="flex-1 flex gap-2 mr-4">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Цена"
                    className="w-24 px-2 py-1 border border-gray-200 rounded text-sm"
                  />
                  <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                </div>
              ) : (
                <div
                  className={`cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                    setEditPrice(item.default_price?.toString() ?? "");
                  }}
                >
                  <span className="text-sm">{item.name}</span>
                  {item.default_price != null && (
                    <span className="text-xs text-gray-500 ml-2">{item.default_price} ₸</span>
                  )}
                </div>
              )}
              <button
                onClick={() => handleToggle(item)}
                className={`text-xs px-2 py-0.5 rounded ${
                  item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {item.is_active ? "Активно" : "Неактивно"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
