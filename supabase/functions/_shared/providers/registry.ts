import type { DiscoveryProvider } from "./types.ts";

export class ProviderRegistry {
  private readonly providers = new Map<string, DiscoveryProvider>();

  register(provider: DiscoveryProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }

    this.providers.set(provider.id, provider);
  }

  get(providerId: string): DiscoveryProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): DiscoveryProvider[] {
    return [...this.providers.values()].sort(
      (a, b) => a.priority - b.priority
    );
  }

  clear(): void {
    this.providers.clear();
  }
}
