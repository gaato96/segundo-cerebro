'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'

export function ShoppingListModal({ shoppingList, onClose }: { shoppingList: any[], onClose: () => void }) {
    const [checkedItems, setCheckedItems] = useState<string[]>([])

    const toggleItem = (itemName: string) => {
        if (checkedItems.includes(itemName)) {
            setCheckedItems(checkedItems.filter(i => i !== itemName))
        } else {
            setCheckedItems([...checkedItems, itemName])
        }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl relative overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-2xl font-heading font-bold">Lista de Compras</h2>
                        <p className="text-sm text-muted-foreground mt-1">Marca los ingredientes que ya tienes o compraste.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-2 flex-1">
                    {shoppingList?.map((item: any, i: number) => {
                        const isChecked = checkedItems.includes(item.item)
                        return (
                            <button
                                key={i}
                                onClick={() => toggleItem(item.item)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isChecked ? 'bg-indigo-500/10 border-indigo-500/20 opacity-60' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <div className="flex items-center gap-4">
                                    {isChecked ? (
                                        <CheckCircle2 className="w-6 h-6 text-indigo-400 shrink-0" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-muted-foreground shrink-0" />
                                    )}
                                    <span className={`text-left font-medium text-base ${isChecked ? 'line-through text-indigo-200' : 'text-white/90'}`}>
                                        {item.item}
                                    </span>
                                </div>
                                <span className={`text-sm font-mono px-3 py-1 rounded-md shrink-0 ml-4 ${isChecked ? 'text-indigo-400/50 bg-transparent' : 'text-indigo-300 bg-indigo-500/10'}`}>
                                    {item.amount} {item.unit}
                                </span>
                            </button>
                        )
                    })}
                    {(!shoppingList || shoppingList.length === 0) && (
                        <div className="text-center py-10 text-muted-foreground">
                            No hay ingredientes en la lista.
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between items-center text-sm font-medium">
                    <span className="text-muted-foreground">{checkedItems.length} comprados</span>
                    <span>{shoppingList?.length - checkedItems.length} pendientes</span>
                </div>
            </div>
        </div>
    )
}
