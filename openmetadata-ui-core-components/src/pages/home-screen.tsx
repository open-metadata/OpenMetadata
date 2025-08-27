import { BookOpen01, Check, Copy01, Cube01, HelpCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { useClipboard } from "@/hooks/use-clipboard";

export const HomeScreen = () => {
    const clipboard = useClipboard();

    return (
        <div className="flex h-dvh flex-col">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
                <div className="relative flex size-28 items-center justify-center">
                    <UntitledLogoMinimal className="size-10" />
                </div>

                <h1 className="max-w-3xl text-center text-display-sm font-semibold text-primary">Untitled UI Vite starter kit</h1>

                <p className="mt-2 max-w-xl text-center text-lg text-tertiary">
                    Get started by using existing components that came with this starter kit or add new ones:
                </p>

                <div className="relative mt-6 flex h-10 items-center rounded-lg border border-secondary bg-secondary">
                    <code className="px-3 font-mono text-secondary">npx untitledui@latest add</code>

                    <hr className="h-10 w-px bg-border-secondary" />

                    <ButtonUtility
                        color="tertiary"
                        size="sm"
                        tooltip="Copy"
                        className="mx-1"
                        icon={clipboard.copied ? Check : Copy01}
                        onClick={() => clipboard.copy("npx untitledui@latest add")}
                    />
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <Button
                        href="https://www.untitledui.com/react/docs/introduction"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={BookOpen01}
                    >
                        Docs
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        href="https://www.untitledui.com/react/resources/icons"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={Cube01}
                    >
                        Icons
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        href="https://github.com/untitleduico/react/issues/"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={HelpCircle}
                    >
                        Help
                    </Button>
                </div>
            </div>
        </div>
    );
};
