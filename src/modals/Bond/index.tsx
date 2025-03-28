// Copyright 2023 @paritytech/polkadot-staking-dashboard authors & contributors
// SPDX-License-Identifier: GPL-3.0-only

import { ModalPadding, ModalWarnings } from '@polkadot-cloud/react';
import { planckToUnit, unitToPlanck } from '@polkadot-cloud/utils';
import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from 'contexts/Api';
import { useActivePools } from 'contexts/Pools/ActivePools';
import { useTransferOptions } from 'contexts/TransferOptions';
import { BondFeedback } from 'library/Form/Bond/BondFeedback';
import { Warning } from 'library/Form/Warning';
import { useBondGreatestFee } from 'library/Hooks/useBondGreatestFee';
import { useSignerWarnings } from 'library/Hooks/useSignerWarnings';
import { useSubmitExtrinsic } from 'library/Hooks/useSubmitExtrinsic';
import { Close } from 'library/Modal/Close';
import { SubmitTx } from 'library/SubmitTx';
import { useTxMeta } from 'contexts/TxMeta';
import { useOverlay } from '@polkadot-cloud/react/hooks';
import { useNetwork } from 'contexts/Network';
import { useActiveAccounts } from 'contexts/ActiveAccounts';

export const Bond = () => {
  const { t } = useTranslation('modals');
  const { api } = useApi();
  const {
    networkData: { units, unit },
  } = useNetwork();
  const { activeAccount } = useActiveAccounts();
  const { notEnoughFunds } = useTxMeta();
  const { selectedActivePool } = useActivePools();
  const { getSignerWarnings } = useSignerWarnings();
  const { feeReserve, getTransferOptions } = useTransferOptions();
  const {
    setModalStatus,
    config: { options },
    setModalResize,
  } = useOverlay().modal;

  const { bondFor } = options;
  const isStaking = bondFor === 'nominator';
  const isPooling = bondFor === 'pool';
  const { nominate, pool } = getTransferOptions(activeAccount);

  const freeBalanceBn =
    bondFor === 'nominator'
      ? nominate.totalAdditionalBond
      : pool.totalAdditionalBond;

  const freeBalance = planckToUnit(freeBalanceBn.minus(feeReserve), units);
  const largestTxFee = useBondGreatestFee({ bondFor });

  // calculate any unclaimed pool rewards.
  let { pendingRewards } = selectedActivePool || {};
  pendingRewards = pendingRewards ?? new BigNumber(0);
  pendingRewards = planckToUnit(pendingRewards, units);

  // local bond value.
  const [bond, setBond] = useState<{ bond: string }>({
    bond: freeBalance.toString(),
  });

  // bond valid.
  const [bondValid, setBondValid] = useState<boolean>(false);

  // feedback errors to trigger modal resize
  const [feedbackErrors, setFeedbackErrors] = useState<string[]>([]);

  // bond minus tx fees.
  const enoughToCoverTxFees: boolean = freeBalance
    .minus(bond.bond)
    .isGreaterThan(planckToUnit(largestTxFee, units));

  // bond value after max tx fees have been deducated.
  let bondAfterTxFees: BigNumber;

  if (enoughToCoverTxFees) {
    bondAfterTxFees = unitToPlanck(String(bond.bond), units);
  } else {
    bondAfterTxFees = BigNumber.max(
      unitToPlanck(String(bond.bond), units).minus(largestTxFee),
      0
    );
  }

  // update bond value on task change.
  useEffect(() => {
    setBond({ bond: freeBalance.toString() });
  }, [freeBalance.toString()]);

  // determine whether this is a pool or staking transaction.
  const determineTx = (bondToSubmit: BigNumber) => {
    let tx = null;
    if (!api) {
      return tx;
    }

    const bondAsString = !bondValid
      ? '0'
      : bondToSubmit.isNaN()
      ? '0'
      : bondToSubmit.toString();

    if (isPooling) {
      tx = api.tx.nominationPools.bondExtra({
        FreeBalance: bondAsString,
      });
    } else if (isStaking) {
      tx = api.tx.staking.bondExtra(bondAsString);
    }
    return tx;
  };

  // the actual bond tx to submit
  const getTx = (bondToSubmit: BigNumber) => {
    if (!api || !activeAccount) {
      return null;
    }
    return determineTx(bondToSubmit);
  };

  const submitExtrinsic = useSubmitExtrinsic({
    tx: getTx(bondAfterTxFees),
    from: activeAccount,
    shouldSubmit: bondValid,
    callbackSubmit: () => {
      setModalStatus('closing');
    },
    callbackInBlock: () => {},
  });

  const warnings = getSignerWarnings(
    activeAccount,
    false,
    submitExtrinsic.proxySupported
  );

  // modal resize on form update
  useEffect(
    () => setModalResize(),
    [bond, bondValid, notEnoughFunds, feedbackErrors.length, warnings.length]
  );

  return (
    <>
      <Close />
      <ModalPadding>
        <h2 className="title unbounded">{t('addToBond')}</h2>
        {pendingRewards > 0 && bondFor === 'pool' ? (
          <ModalWarnings withMargin>
            <Warning
              text={`${t('bondingWithdraw')} ${pendingRewards} ${unit}.`}
            />
          </ModalWarnings>
        ) : null}
        <BondFeedback
          syncing={largestTxFee.isZero()}
          bondFor={bondFor}
          listenIsValid={(valid, errors) => {
            setBondValid(valid);
            setFeedbackErrors(errors);
          }}
          defaultBond={null}
          setters={[
            {
              set: setBond,
              current: bond,
            },
          ]}
          parentErrors={warnings}
          txFees={largestTxFee}
        />
        <p>{t('newlyBondedFunds')}</p>
      </ModalPadding>
      <SubmitTx valid={bondValid} {...submitExtrinsic} />
    </>
  );
};
