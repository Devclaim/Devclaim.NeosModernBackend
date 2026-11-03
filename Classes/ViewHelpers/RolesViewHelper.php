<?php

declare(strict_types=1);

namespace Devclaim\NeosModernBackend\ViewHelpers;

use Devclaim\NeosModernBackend\UserRoles\RoleDescriptions;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Security\Account;
use Neos\FluidAdaptor\Core\ViewHelper\AbstractViewHelper;

/**
 * The roles of the user module as people read them ({@see RoleDescriptions}), for the partials of the modern backend
 * (Resources/Private/Partials/UserModule):
 *
 *   {namespace dc=Devclaim\NeosModernBackend\ViewHelpers}
 *   <f:for each="{dc:roles(roles: availableRoles, account: account)}" as="role">…</f:for>
 */
class RolesViewHelper extends AbstractViewHelper
{
    /** an array for f:for, not text */
    protected $escapeOutput = false;

    #[Flow\Inject]
    protected RoleDescriptions $roleDescriptions;

    public function initializeArguments(): void
    {
        $this->registerArgument('roles', 'array', 'The roles (Neos\Flow\Security\Policy\Role)', true);
        $this->registerArgument('account', Account::class, 'The account whose assigned roles are marked', false);
    }

    /** @return list<array<string, mixed>> */
    public function render(): array
    {
        $account = $this->arguments['account'];

        return $this->roleDescriptions->describe(
            $this->arguments['roles'],
            $account instanceof Account ? $account : null,
        );
    }
}
