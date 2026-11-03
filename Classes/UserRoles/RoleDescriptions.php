<?php

declare(strict_types=1);

namespace Devclaim\NeosModernBackend\UserRoles;

use Neos\Flow\Annotations as Flow;
use Neos\Flow\Security\Account;
use Neos\Flow\Security\Policy\Role;
use Neos\Neos\Security\Authorization\Privilege\ModulePrivilege;

/**
 * The roles of the user module as people read them (Resources/Private/Partials/UserModule): per role its name, what it
 * is for, the roles it contains and what it allows. What it allows comes from the policy: the modules it opens (by
 * their names in the menu) and the labels of its other granted privileges, those of abstract parent roles included
 * (they are never shown on their own). The setting Devclaim.NeosModernBackend.userRoles.<role> replaces any of it with
 * texts of the project (label, description, can; derive: false leaves out what the policy says, for roles whose
 * privileges are technical, like those of Neos) and orders the roles (position).
 */
#[Flow\Scope('singleton')]
final class RoleDescriptions
{
    /** @var array<string, array{label?: string, description?: string, can?: list<string>, derive?: bool, position?: int}> */
    #[Flow\InjectConfiguration(path: 'userRoles', package: 'Devclaim.NeosModernBackend')]
    protected array $configuration = [];

    /** @var array<string, mixed> */
    #[Flow\InjectConfiguration(path: 'modules', package: 'Neos.Neos')]
    protected array $modules = [];

    /**
     * @param iterable<Role> $roles
     * @return list<array{identifier: string, label: string, description: string, packageKey: string, assigned: bool, contains: list<string>, containsLabels: list<string>, can: list<array{text: string, translate: bool}>}>
     */
    public function describe(iterable $roles, ?Account $account = null): array
    {
        $descriptions = [];
        foreach ($roles as $role) {
            $configuration = $this->configuration[$role->getIdentifier()] ?? [];
            $descriptions[] = [
                'position' => $configuration['position'] ?? 1000,
                'identifier' => $role->getIdentifier(),
                'label' => $this->label($role),
                'description' => $configuration['description'] ?? $role->getDescription(),
                'packageKey' => $role->getPackageKey(),
                'assigned' => $account?->hasRole($role) ?? false,
                // all it contains (a contained role is ticked by it); named: only the ones that are shown
                'contains' => array_values(array_map(
                    static fn (Role $parent): string => $parent->getIdentifier(),
                    $role->getAllParentRoles(),
                )),
                'containsLabels' => array_values(array_map(
                    fn (Role $parent): string => $this->label($parent),
                    array_filter($role->getParentRoles(), static fn (Role $parent): bool => !$parent->isAbstract()),
                )),
                'can' => [
                    ...array_map(
                        static fn (string $text): array => ['text' => $text, 'translate' => false],
                        $configuration['can'] ?? [],
                    ),
                    ...(($configuration['derive'] ?? true) ? $this->derived($role) : []),
                ],
            ];
        }
        usort(
            $descriptions,
            static fn (array $a, array $b): int => [$a['position'], $a['label']] <=> [$b['position'], $b['label']],
        );

        return array_map(static function (array $description): array {
            unset($description['position']);
            return $description;
        }, $descriptions);
    }

    public function label(Role $role): string
    {
        return $this->configuration[$role->getIdentifier()]['label'] ?? ($role->getLabel() ?: $role->getName());
    }

    /**
     * What the policy grants the role itself and its abstract parents: modules by their label (a translation id, the
     * template translates it), the rest by the label of its privilege target; without a label nothing (technical)
     *
     * @return list<array{text: string, translate: bool}>
     */
    private function derived(Role $role): array
    {
        $roles = [$role, ...$this->abstractAncestors($role)];
        $permissions = [];
        foreach ($roles as $source) {
            foreach ($source->getPrivileges() as $privilege) {
                if (!$privilege->isGranted()) {
                    continue;
                }
                $target = $privilege->getPrivilegeTarget();
                if ($privilege instanceof ModulePrivilege) {
                    $label = $this->moduleLabel($privilege->getMatcher());
                    if ($label !== null) {
                        $permissions[$label] = ['text' => $label, 'translate' => true];
                    }
                    continue;
                }
                $label = $target->getLabel();
                if ($label !== '') {
                    $permissions[$label] ??= ['text' => $label, 'translate' => false];
                }
            }
        }

        return array_values($permissions);
    }

    /** @return list<Role> */
    private function abstractAncestors(Role $role): array
    {
        $ancestors = [];
        foreach ($role->getParentRoles() as $parent) {
            if ($parent->isAbstract()) {
                $ancestors = [...$ancestors, $parent, ...$this->abstractAncestors($parent)];
            }
        }
        return $ancestors;
    }

    /** the label of a module from its path ("administration/users"), as in the menu */
    private function moduleLabel(string $modulePath): ?string
    {
        $configuration = ['submodules' => $this->modules];
        foreach (explode('/', trim($modulePath, "' ")) as $segment) {
            $configuration = $configuration['submodules'][$segment] ?? null;
            if (!is_array($configuration)) {
                return null;
            }
        }
        $label = $configuration['label'] ?? '';

        return is_string($label) && $label !== '' ? $label : null;
    }
}
