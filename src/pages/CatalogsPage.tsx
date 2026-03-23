import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  type CatalogItem,
  type ExtraOptionType,
  type CodeCatalogItem,
  type PrintCategoryItem,
  type CreateCatalogInput,
  type UpdateCatalogInput,
  type CreateExtraOptionInput,
  type UpdateExtraOptionInput,
  type CreateCodeCatalogInput,
  type UpdateCodeCatalogInput,
  type BookCoverOptionItem,
  type CoverFamilyItem,
} from "@/infrastructure/tauri-bridge";

// ── Transliteration helper ───────────────────────────────────────────

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

function toCode(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Types ────────────────────────────────────────────────────────────

interface CatalogDef {
  key: string;
  label: string;
  type: "simple" | "extra" | "code" | "print_category" | "cover_options";
}

const CATALOG_DEFS: CatalogDef[] = [
  { key: "book_formats", label: "Форматы фотокниг", type: "simple" },
  { key: "print_formats", label: "Форматы печати", type: "simple" },
  { key: "print_categories", label: "Категории печати", type: "print_category" },
  { key: "assembly_kinds", label: "Типы сборки книг", type: "code" },
  { key: "cover_families", label: "Типы обложек книг", type: "code" },
  { key: "book_cover_options", label: "Опции обложек", type: "cover_options" },
  { key: "wide_format_materials", label: "Материалы широкоформатки", type: "simple" },
  { key: "lamination_types", label: "Типы ламинации", type: "simple" },
  { key: "extra_option_types", label: "Доп. опции", type: "extra" },
];

const CATALOG_COMMANDS: Record<string, {
  listAll: () => Promise<CatalogItem[]>;
  create: (input: CreateCatalogInput) => Promise<CatalogItem>;
  update: (id: number, input: UpdateCatalogInput) => Promise<CatalogItem>;
  delete: (id: number) => Promise<void>;
}> = {
  book_formats: { listAll: catalogs.allBookFormats, create: catalogs.createBookFormat, update: catalogs.updateBookFormat, delete: catalogs.deleteBookFormat },
  print_formats: { listAll: catalogs.allPrintFormats, create: catalogs.createPrintFormat, update: catalogs.updatePrintFormat, delete: catalogs.deletePrintFormat },
  lamination_types: { listAll: catalogs.allLaminationTypes, create: catalogs.createLaminationType, update: catalogs.updateLaminationType, delete: catalogs.deleteLaminationType },
  wide_format_materials: { listAll: catalogs.allWideFormatMaterials, create: catalogs.createWideFormatMaterial, update: catalogs.updateWideFormatMaterial, delete: catalogs.deleteWideFormatMaterial },
};

const CODE_CATALOG_COMMANDS: Record<string, {
  listAll: () => Promise<CodeCatalogItem[]>;
  create: (input: CreateCodeCatalogInput) => Promise<CodeCatalogItem>;
  update: (id: number, input: UpdateCodeCatalogInput) => Promise<CodeCatalogItem>;
  delete: (id: number) => Promise<void>;
}> = {
  assembly_kinds: { listAll: catalogs.allAssemblyKinds, create: catalogs.createAssemblyKind, update: catalogs.updateAssemblyKind, delete: catalogs.deleteAssemblyKind },
  cover_families: { listAll: catalogs.allCoverFamilies, create: catalogs.createCoverFamily, update: catalogs.updateCoverFamily, delete: catalogs.deleteCoverFamily },
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
      {activeDef.type === "code" && (
        <CodeCatalogEditor catalogKey={activeTab} />
      )}
      {activeDef.type === "cover_options" && <CoverOptionsEditor />}
      {activeDef.type === "print_category" && <PrintCategoriesEditor />}
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

  const handleDelete = async (item: CatalogItem) => {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await cmds.delete(item.id);
      toast.success("Удалено");
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
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between group">
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggle(item)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.is_active ? "Активно" : "Неактивно"}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                >
                  Удл.
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CoverOptionsEditor() {
  const { data: options, refetch } = useTauriCommand(catalogs.allBookCoverOptions);
  const { data: coverFamilies } = useTauriCommand(catalogs.allCoverFamilies);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await catalogs.createBookCoverOption({ name: newName.trim() });
      toast.success("Добавлено");
      setNewName("");
      setShowAdd(false);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await catalogs.updateBookCoverOption(id, { name: editName.trim() });
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleToggle = async (item: BookCoverOptionItem) => {
    try {
      await catalogs.updateBookCoverOption(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleDelete = async (item: BookCoverOptionItem) => {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await catalogs.deleteBookCoverOption(item.id);
      toast.success("Удалено");
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const toggleFamily = async (optionId: number, familyCode: string, currentCodes: string[]) => {
    const newCodes = currentCodes.includes(familyCode)
      ? currentCodes.filter((c) => c !== familyCode)
      : [...currentCodes, familyCode];
    try {
      await catalogs.setCoverOptionFamilies(optionId, newCodes);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const families = (coverFamilies ?? []) as CoverFamilyItem[];

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{options?.length ?? 0} записей</span>
        <button className="text-blue-600 text-sm hover:text-blue-700" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название"
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            Добавить
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {!options || options.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Пусто</div>
        ) : (
          options.map((item) => (
            <div key={item.id} className="px-5 py-2.5 group">
              <div className="flex items-center justify-between">
                {editingId === item.id ? (
                  <div className="flex-1 flex gap-2 mr-4">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)} autoFocus />
                    <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                  </div>
                ) : (
                  <span className={`text-sm cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                    onClick={() => { setEditingId(item.id); setEditName(item.name); }}>
                    {item.name}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleToggle(item)}
                    className={`text-xs px-2 py-0.5 rounded ${item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.is_active ? "Активно" : "Неактивно"}
                  </button>
                  <button onClick={() => handleDelete(item)}
                    className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                    Удл.
                  </button>
                </div>
              </div>
              {/* Family chips */}
              {families.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {families.map((fam) => {
                    const active = item.cover_family_codes.includes(fam.code);
                    return (
                      <button key={fam.code} onClick={() => toggleFamily(item.id, fam.code, item.cover_family_codes)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          active ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}>
                        {fam.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
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

  const handleDelete = async (item: ExtraOptionType) => {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await catalogs.deleteExtraOptionType(item.id);
      toast.success("Удалено");
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
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between group">
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggle(item)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.is_active ? "Активно" : "Неактивно"}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                >
                  Удл.
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Code catalog editor (code + name) ───────────────────────────────

function CodeCatalogEditor({ catalogKey }: { catalogKey: string }) {
  const cmds = CODE_CATALOG_COMMANDS[catalogKey];
  const { data, refetch } = useTauriCommand(cmds.listAll, [catalogKey]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await cmds.create({ code: toCode(newName), name: newName.trim() });
      toast.success("Добавлено");
      setNewName("");
      setShowAdd(false);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleUpdate = async (id: number) => {
    try {
      const name = editName.trim() || undefined;
      await cmds.update(id, { code: name ? toCode(name) : undefined, name });
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleToggle = async (item: CodeCatalogItem) => {
    try {
      await cmds.update(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleDelete = async (item: CodeCatalogItem) => {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await cmds.delete(item.id);
      toast.success("Удалено");
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{data?.length ?? 0} записей</span>
        <button className="text-blue-600 text-sm hover:text-blue-700" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название" className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500" onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
          <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Добавить</button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {!data || data.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Пусто</div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between group">
              {editingId === item.id ? (
                <div className="flex-1 flex gap-2 mr-4">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500" onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)} autoFocus />
                  <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                </div>
              ) : (
                <div
                  className={`cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                  onClick={() => { setEditingId(item.id); setEditName(item.name); }}
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({item.code})</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleToggle(item)} className={`text-xs px-2 py-0.5 rounded ${item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.is_active ? "Активно" : "Неактивно"}
                </button>
                <button onClick={() => handleDelete(item)} className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                  Удл.
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Print categories editor ─────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  format: "Формат печати",
  material: "Материал широкоформатки",
  lamination: "Тип ламинации",
};

function PrintCategoriesEditor() {
  const { data, refetch } = useTauriCommand(catalogs.allPrintCategories);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("шт.");
  const [newFieldType, setNewFieldType] = useState("format");
  const [newHasPrinting, setNewHasPrinting] = useState(true);
  const [newHasAssembly, setNewHasAssembly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editFieldType, setEditFieldType] = useState("");
  const [editHasPrinting, setEditHasPrinting] = useState(true);
  const [editHasAssembly, setEditHasAssembly] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await catalogs.createPrintCategory({
        code: toCode(newName), name: newName.trim(),
        unit: newUnit || "шт.", field_type: newFieldType,
        has_printing: newHasPrinting, has_assembly: newHasAssembly,
      });
      toast.success("Добавлено");
      setNewName(""); setNewUnit("шт."); setNewFieldType("format");
      setNewHasPrinting(true); setNewHasAssembly(false);
      setShowAdd(false);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleUpdate = async (id: number) => {
    try {
      const name = editName.trim() || undefined;
      await catalogs.updatePrintCategory(id, {
        code: name ? toCode(name) : undefined, name,
        unit: editUnit || undefined, field_type: editFieldType || undefined,
        has_printing: editHasPrinting, has_assembly: editHasAssembly,
      });
      toast.success("Обновлено");
      setEditingId(null);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleToggle = async (item: PrintCategoryItem) => {
    try {
      await catalogs.updatePrintCategory(item.id, { is_active: !item.is_active });
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handleDelete = async (item: PrintCategoryItem) => {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    try {
      await catalogs.deletePrintCategory(item.id);
      toast.success("Удалено");
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold">{data?.length ?? 0} категорий</span>
        <button className="text-blue-600 text-sm hover:text-blue-700" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Отмена" : "+ Добавить"}
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название" className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500" autoFocus />
          </div>
          <div className="flex gap-2 items-center">
            <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Ед. изм." className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500" />
            <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded text-sm">
              {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" checked={newHasPrinting} onChange={(e) => setNewHasPrinting(e.target.checked)} /> Печать
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" checked={newHasAssembly} onChange={(e) => setNewHasAssembly(e.target.checked)} /> Сборка
            </label>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Добавить</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {!data || data.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Пусто</div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between group">
              {editingId === item.id ? (
                <div className="flex-1 space-y-1 mr-4">
                  <div className="flex gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" autoFocus />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-sm" />
                    <select value={editFieldType} onChange={(e) => setEditFieldType(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm">
                      {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={editHasPrinting} onChange={(e) => setEditHasPrinting(e.target.checked)} /> Печать
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={editHasAssembly} onChange={(e) => setEditHasAssembly(e.target.checked)} /> Сборка
                    </label>
                    <button onClick={() => handleUpdate(item.id)} className="text-xs text-blue-600">OK</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Отмена</button>
                  </div>
                </div>
              ) : (
                <div
                  className={`cursor-pointer hover:text-blue-600 ${!item.is_active ? "text-gray-400 line-through" : ""}`}
                  onClick={() => { setEditingId(item.id); setEditName(item.name); setEditUnit(item.unit); setEditFieldType(item.field_type); setEditHasPrinting(item.has_printing); setEditHasAssembly(item.has_assembly); }}
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({item.code})</span>
                  <span className="text-xs text-gray-400 ml-2">{item.unit}</span>
                  <span className="text-xs text-gray-400 ml-1">/ {FIELD_TYPE_LABELS[item.field_type] ?? item.field_type}</span>
                  {item.has_printing && <span className="text-xs ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">печать</span>}
                  {item.has_assembly && <span className="text-xs ml-1 px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded">сборка</span>}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleToggle(item)} className={`text-xs px-2 py-0.5 rounded ${item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.is_active ? "Активно" : "Неактивно"}
                </button>
                <button onClick={() => handleDelete(item)} className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                  Удл.
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
