import type { OverviewData } from "@/types/api";
import { CategoryRow } from "./category-row";

interface CategoryListProps {
  categories: OverviewData["categories"];
}

/** Renders all non-empty credit categories as expandable rows. */
export function CategoryList({ categories }: CategoryListProps) {
  const nonEmpty = categories.filter((c) => c.totalValue > 0);

  if (nonEmpty.length === 0) return null;

  return (
    <div>
      {nonEmpty.map((category) => (
        <CategoryRow key={category.category} category={category} />
      ))}
    </div>
  );
}
