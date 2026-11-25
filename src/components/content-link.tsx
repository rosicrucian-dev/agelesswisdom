import { Link } from "@/components/locale-link";
import { ArticleIcon } from "@/icons/article-icon";

/** A lesson entry in the overview list: icon, numbered title, description. */
export function ContentLink({
  title,
  description,
  href,
}: {
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <div className="flow-root">
      <Link
        href={href}
        className="-mx-3 -my-2 flex gap-3 rounded-xl px-3 py-2 text-sm/7 hover:bg-gray-950/4 dark:hover:bg-white/5"
      >
        <div className="flex h-lh shrink items-center">
          <ArticleIcon className="fill-gray-950 stroke-gray-950/40 dark:fill-white dark:stroke-white/40" />
        </div>
        <div>
          <span className="font-semibold text-gray-950 dark:text-white">
            {title}
          </span>
          {description && (
            <p className="text-gray-700 dark:text-gray-400">{description}</p>
          )}
        </div>
      </Link>
    </div>
  );
}
