// Copyright 2023 @paritytech/polkadot-staking-dashboard authors & contributors
// SPDX-License-Identifier: GPL-3.0-only

import { faCopy } from '@fortawesome/free-regular-svg-icons';
import { faBars, faProjectDiagram } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenu } from 'contexts/Menu';
import { useNotifications } from 'contexts/Notifications';
import type { NotificationText } from 'contexts/Notifications/types';
import { useBondedPools } from 'contexts/Pools/BondedPools';
import { usePoolMemberships } from 'contexts/Pools/PoolMemberships';
import { useUi } from 'contexts/UI';
import { useValidators } from 'contexts/Validators/ValidatorEntries';
import { usePoolCommission } from 'library/Hooks/usePoolCommission';
import { FavoritePool } from 'library/ListItem/Labels/FavoritePool';
import { PoolBonded } from 'library/ListItem/Labels/PoolBonded';
import { PoolCommission } from 'library/ListItem/Labels/PoolCommission';
import { PoolIdentity } from 'library/ListItem/Labels/PoolIdentity';
import {
  Labels,
  MenuPosition,
  Separator,
  Wrapper,
} from 'library/ListItem/Wrappers';
import { usePoolsTabs } from 'pages/Pools/Home/context';
import { useOverlay } from '@polkadot-cloud/react/hooks';
import { useActiveAccounts } from 'contexts/ActiveAccounts';
import { useImportedAccounts } from 'contexts/Connect/ImportedAccounts';
import { JoinPool } from '../ListItem/Labels/JoinPool';
import { Members } from '../ListItem/Labels/Members';
import { PoolId } from '../ListItem/Labels/PoolId';
import type { PoolProps } from './types';
import { Rewards } from './Rewards';

export const Pool = ({ pool, batchKey, batchIndex }: PoolProps) => {
  const { t } = useTranslation('library');
  const { memberCounter, addresses, id, state } = pool;
  const { isPoolSyncing } = useUi();
  const { meta } = useBondedPools();
  const { validators } = useValidators();
  const { setActiveTab } = usePoolsTabs();
  const { openModal } = useOverlay().modal;
  const { membership } = usePoolMemberships();
  const { activeAccount } = useActiveAccounts();
  const { addNotification } = useNotifications();
  const { isReadOnlyAccount } = useImportedAccounts();
  const { getCurrentCommission } = usePoolCommission();
  const { setMenuPosition, setMenuItems, open }: any = useMenu();

  const currentCommission = getCurrentCommission(id);

  // get metadata from pools metabatch
  const nominations = meta[batchKey]?.nominations ?? [];

  // get pool targets from nominations metadata
  const targets = nominations[batchIndex]?.targets ?? [];

  // extract validator entries from pool targets
  const targetValidators = validators.filter(({ address }) =>
    targets.includes(address)
  );

  // configure floating menu position
  const posRef = useRef(null);

  // copy address notification
  const notificationCopyAddress: NotificationText | null =
    addresses.stash == null
      ? null
      : {
          title: t('addressCopiedToClipboard'),
          subtitle: addresses.stash,
        };

  // consruct pool menu items
  const menuItems: any[] = [];

  // add view pool nominations button to menu
  menuItems.push({
    icon: <FontAwesomeIcon icon={faProjectDiagram} transform="shrink-3" />,
    wrap: null,
    title: `${t('viewPoolNominations')}`,
    cb: () => {
      openModal({
        key: 'PoolNominations',
        options: {
          nominator: addresses.stash,
          targets: targetValidators,
        },
      });
    },
  });

  // add copy pool address button to menu
  menuItems.push({
    icon: <FontAwesomeIcon icon={faCopy} transform="shrink-3" />,
    wrap: null,
    title: t('copyPoolAddress'),
    cb: () => {
      navigator.clipboard.writeText(addresses.stash);
      if (notificationCopyAddress) {
        addNotification(notificationCopyAddress);
      }
    },
  });

  // toggle menu handler
  const toggleMenu = () => {
    if (!open) {
      setMenuItems(menuItems);
      setMenuPosition(posRef);
    }
  };

  const displayJoin =
    !isPoolSyncing &&
    state === 'Open' &&
    !membership &&
    !isReadOnlyAccount(activeAccount) &&
    activeAccount;

  return (
    <Wrapper className={displayJoin ? 'pool-join' : 'pool'}>
      <div className="inner">
        <MenuPosition ref={posRef} />
        <div className="row top">
          <PoolIdentity
            batchKey={batchKey}
            batchIndex={batchIndex}
            pool={pool}
          />
          <div>
            <Labels>
              <FavoritePool address={addresses.stash} />
              <div className="label">
                <button type="button" onClick={() => toggleMenu()}>
                  <FontAwesomeIcon icon={faBars} transform="shrink-2" />
                </button>
              </div>
            </Labels>
          </div>
        </div>
        <Separator />
        <div className="row bottom lg">
          <div>
            <Rewards address={addresses.stash} displayFor="default" />
          </div>
          <div>
            <Labels style={{ marginBottom: '0.9rem' }}>
              {currentCommission > 0 && (
                <PoolCommission commission={`${currentCommission}%`} />
              )}
              <PoolId id={id} />
              <Members members={memberCounter} />
            </Labels>
            <PoolBonded
              pool={pool}
              batchIndex={batchIndex}
              batchKey={batchKey}
            />
            {displayJoin && (
              <Labels style={{ marginTop: '1rem' }}>
                <JoinPool id={id} setActiveTab={setActiveTab} />
              </Labels>
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
};
