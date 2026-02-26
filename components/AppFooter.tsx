import packageJson from "@/package.json";

const READX_IMAGE_URL =
  "https://raw.githubusercontent.com/federonco/readx-assets/main/readX%20orange.png";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 text-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Created by</span>
          <a
            href="https://www.readx.com.au"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit ReadX website"
            className="inline-flex cursor-pointer items-center gap-0.5"
          >
            <img
              src={READX_IMAGE_URL}
              alt="readX"
              className="h-[0.75em] w-auto align-middle"
            />
            <sup className="text-[10px]">™</sup>
          </a>
        </div>
        <div className="text-xs text-gray-500">
          All rights Reserved
          {" · "}
          v{packageJson.version}
        </div>
      </div>
    </footer>
  );
}
