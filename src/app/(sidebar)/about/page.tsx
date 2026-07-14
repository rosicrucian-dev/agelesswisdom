import {
  Breadcrumb,
  BreadcrumbHome,
  Breadcrumbs,
  BreadcrumbSeparator,
} from "@/components/breadcrumbs";
import { SidebarLayoutContent } from "@/components/sidebar-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - The School of Ageless Wisdom",
  description: "About this site",
};

export default function Page() {
  return (
    <SidebarLayoutContent
      breadcrumbs={
        <Breadcrumbs>
          <BreadcrumbHome />
          <BreadcrumbSeparator />
          <Breadcrumb>About</Breadcrumb>
        </Breadcrumbs>
      }
    >
      <div className="mx-auto max-w-2xl py-10 sm:py-14">
        <div className="prose">
          <h1>About</h1>
          <p>
            In 1923, Paul Foster Case formed The School of Ageless Wisdom in Boston to serve as the outer order for The Hermetic Order of Aquarius. The school laid the foundations for what would later become the <a href="https://bota.org">Builders of the Adytum</a>, which is still in operation to this day. Starting in 2008, the lessons were published for the first time by the <a href="https://lvx.org">Fraternity of the Hidden Light</a> and the <a href="http://www.rogd.org">Rosicrucian Order of the Golden Dawn</a>, but unfortunately are now of print and difficult to find.
          </p>
          <p>
            This project was created to centrally organize the entire curriculum and present the lessons in a more accessible format for the modern era. The source material for these lessons was generously contributed by Tony DeLuce.
          </p>
          <p>
            This website is a project of{' '}
            <a href="https://github.com/rosicrucian-dev">
              Rosicrucian Developers
            </a>
            . For questions, contact the lead developer,{' '}
            <a href="mailto:jonathan@rosicrucian.dev">Jonathan</a>.
          </p>

          <h2>Other Projects from Rosicrucian Developers</h2>
          <ul>
            <li><a href="http://botatoolbox.org">BOTA Toolbox</a> - An unofficial set of advanced tools for members of the Builders of the Adytum.</li>
          </ul>
          <br/>
        </div>
      </div>
    </SidebarLayoutContent>
  );
}
