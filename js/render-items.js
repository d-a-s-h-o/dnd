class RenderItems{static $getRenderedItem(item){const[damage,damageType,propertiesTxt]=Renderer.item.getDamageAndPropertiesText(item);const renderedText=Renderer.item.getRenderedEntries(item);const textLeft=[Parser.itemValueToFullMultiCurrency(item),Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst();const textRight=[damage,damageType,propertiesTxt].filter(Boolean).join(" ");return $$`
			${Renderer.utils.getBorderTr()}
			${Renderer.utils.getExcludedTr(item,"item")}
			${Renderer.utils.getNameTr(item,{page:UrlUtil.PG_ITEMS})}
			<tr><td class="rd-item__type-rarity-attunement" colspan="6">${Renderer.item.getTypeRarityAndAttunementText(item).uppercaseFirst()}</td></tr>
			${textLeft&&textRight?`<tr>\n\t\t\t\t<td colspan="2">${textLeft}</td>\n\t\t\t\t<td class="text-right" colspan="4">${textRight}</td>\n\t\t\t</tr>`:`<tr><td colspan="6">${textLeft||textRight}</td></tr>`}

			${renderedText?`<tr><td class="divider" colspan="6"><div/></td></tr>\n\t\t\t<tr class="text"><td colspan="6">${renderedText}</td></tr>`:""}
			${Renderer.utils.getPageTr(item)}
			${Renderer.utils.getBorderTr()}
		`}}