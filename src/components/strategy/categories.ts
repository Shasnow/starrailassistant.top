/** 攻略关键词分类：只读标题与描述，不写入后端 */

export interface CategoryRule {
  id: string;
  label: string;
  pattern: RegExp;
}

export const CATEGORY_RULES: CategoryRule[] = [
  { id: "quantum", label: "量子同频", pattern: /量子同频|量子/ },
  { id: "express", label: "列车同行", pattern: /列车同行|列车/ },
  { id: "beast", label: "奇兽花园", pattern: /奇兽花园|奇兽/ },
  { id: "skill", label: "战技点", pattern: /战技点/ },
  { id: "combo", label: "连击", pattern: /连击/ },
  { id: "overclock", label: "超频博弈", pattern: /超频/ },
  { id: "xianzhou", label: "仙舟", pattern: /仙舟/ },
  { id: "dot", label: "持续伤害", pattern: /持续伤害|DOT|D0T|灼烧|触电/i },
  { id: "econ", label: "装备经济", pattern: /装备|合成|经济|金币|晶矿/ },
  { id: "star3", label: "3星核心", pattern: /3星|三星/ },
];

export const OTHER_CATEGORY = "other";

export function categoryLabel(id: string): string {
  if (id === OTHER_CATEGORY) return "其他";
  return CATEGORY_RULES.find((rule) => rule.id === id)?.label ?? id;
}

/** 返回命中的全部分类；全部未命中时归入“其他” */
export function categoriesOf(item: { title: string; description: string }): string[] {
  const text = `${item.title} ${item.description}`;
  const matched = CATEGORY_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
  return matched.length ? matched : [OTHER_CATEGORY];
}
