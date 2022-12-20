import * as Tabs from "@radix-ui/react-tabs";
import type {LinksFunction, LoaderFunction, MetaFunction} from "@remix-run/node";
import {json} from "@remix-run/node";
import {useLoaderData} from "@remix-run/react";
import "ag-grid-enterprise";
import {AgGridReact} from "ag-grid-react";
import {BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip} from "chart.js";
import {DateTime} from "luxon";
import {useEffect, useState} from "react";
import {Bar, Line} from "react-chartjs-2";
import {AdsDataAggregatedRow, FreshsalesData, FreshsalesDataAggregatedRow, getAdsData, getFreshsalesData, getShopifyData, ShopifyDataAggregatedRow, TimeGranularity} from "~/backend/business-insights";
import {getProductLibrary, getCapturedUtmCampaignLibrary, ProductInformation, SourceInformation} from "~/backend/common";
import {createGroupByReducer, doesAdsCampaignNameCorrespondToPerformanceLead, doesLeadCaptureSourceCorrespondToPerformanceLead} from "~/backend/utilities/utilities";
import {HorizontalSpacer} from "~/components/reusableComponents/horizontalSpacer";
import {Card, DateFilterSection, FancySearchableMultiSelect, GenericCard, ValueDisplayingCard} from "~/components/scratchpad";
import {Iso8601Date, QueryFilterType, ValueDisplayingCardInformationType} from "~/utilities/typeDefinitions";
import {agGridDateComparator, dateToMediumNoneEnFormat, distinct, getDates, getNonEmptyStringOrNull, numberToHumanFriendlyString, roundOffToTwoDigits} from "~/utilities/utilities";

export const meta: MetaFunction = () => {
    return {
        title: "Business Insights - Intellsys",
    };
};

export const links: LinksFunction = () => {
    return [
        {rel: "stylesheet", href: "https://unpkg.com/ag-grid-community/styles/ag-grid.css"},
        {rel: "stylesheet", href: "https://unpkg.com/ag-grid-community/styles/ag-theme-alpine.css"},
    ];
};

type LoaderData = {
    appliedMinDate: Iso8601Date;
    appliedMaxDate: Iso8601Date;
    appliedSelectedGranularity: string;
    allProductInformation: Array<ProductInformation>;
    allSourceInformation: Array<SourceInformation>;
    freshsalesLeadsData: FreshsalesData;
    adsData: {
        metaQuery: string;
        rows: Array<AdsDataAggregatedRow>;
    };
    shopifyData: {
        metaQuery: string;
        rows: Array<ShopifyDataAggregatedRow>;
    };
};

export const loader: LoaderFunction = async ({request}) => {
    const urlSearchParams = new URL(request.url).searchParams;

    const minDateRaw = urlSearchParams.get("min_date");
    let minDate;
    if (minDateRaw == null || minDateRaw.length == 0) {
        minDate = DateTime.now().startOf("month").toISODate();
    } else {
        minDate = minDateRaw;
    }

    const maxDateRaw = urlSearchParams.get("max_date");
    let maxDate;
    if (maxDateRaw == null || maxDateRaw.length == 0) {
        maxDate = DateTime.now().toISODate();
    } else {
        maxDate = maxDateRaw;
    }

    // TODO: Make a function for parsing this
    const selectedGranularityRaw = getNonEmptyStringOrNull(urlSearchParams.get("selected_granularity"));
    let selectedGranularity: TimeGranularity;
    if (selectedGranularityRaw == null || selectedGranularityRaw.length == 0) {
        selectedGranularity = TimeGranularity.daily;
    } else {
        selectedGranularity = selectedGranularityRaw;
    }

    const loaderData: LoaderData = {
        appliedMinDate: minDate,
        appliedMaxDate: maxDate,
        appliedSelectedGranularity: selectedGranularity,
        allProductInformation: await getProductLibrary(),
        allSourceInformation: await getCapturedUtmCampaignLibrary(),
        freshsalesLeadsData: await getFreshsalesData(minDate, maxDate, selectedGranularity),
        adsData: await getAdsData(minDate, maxDate, selectedGranularity),
        shopifyData: await getShopifyData(minDate, maxDate, selectedGranularity),
    };

    return json(loaderData);
};

export default function () {
    const {appliedMinDate, appliedMaxDate, allProductInformation, allSourceInformation, freshsalesLeadsData, adsData, shopifyData} = useLoaderData() as LoaderData;

    // Default values of filters
    const businesses = distinct(allProductInformation.map((productInformation) => productInformation.category));
    let products = distinct(allProductInformation.map((productInformation) => productInformation.productName));
    let campaigns = distinct(allSourceInformation.map((sourceInformation) => sourceInformation.productName));
    const platforms = distinct(allSourceInformation.map((sourceInformation) => sourceInformation.platform));

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState([]);
    const [selectedGranularity, setSelectedGranularity] = useState("Daily");
    const [selectedMinDate, setSelectedMinDate] = useState(appliedMinDate ?? "");
    const [selectedMaxDate, setSelectedMaxDate] = useState(appliedMaxDate ?? "");

    products = allProductInformation
        .filter((productInformation) => selectedCategories.length == 0 || selectedCategories.includes(productInformation.category))
        .map((productInformation) => productInformation.productName);
    campaigns = distinct(
        allSourceInformation
            .filter((sourceInformation) => selectedCategories.length == 0 || selectedCategories.includes(sourceInformation.category))
            .filter((sourceInformation) => selectedPlatforms.length == 0 || selectedPlatforms.includes(sourceInformation.platform))
            .map((sourceInformation) => sourceInformation.campaignName)
    );
    const granularities = ["Daily", "Weekly", "Monthly", "Yearly"];

    useEffect(() => {
        setSelectedProducts([]);
        setSelectedPlatforms([]);
        setSelectedCampaigns([]);
    }, [selectedCategories]);

    useEffect(() => {
        setSelectedCampaigns([]);
    }, [selectedProducts]);

    const numberOfSelectedDays = DateTime.fromISO(appliedMaxDate).diff(DateTime.fromISO(appliedMinDate), "days").toObject().days! + 1;

    const r5_marketingAcos = "?";
    const r5_facebookAcos = "?";
    const r5_agentAcos = "?";
    const r5_googleAcos = "?";
    const r5_highestAcos = "?";
    const r5_lowestAcos = "?";
    const r5_netAcos = "?";

    // TODO: remove before push
    // const shopifyDataToExportAsCsv = {
    //     data: shopifyData.rows || [],
    //     filename: "shopifyData",
    //     delimiter: ",",
    // };

    // const adsDataToExportAsCsv = {
    //     data: adsData.rows || [],
    //     filename: "adsData",
    //     delimiter: ",",
    // };

    // const leadsDataToExportAsCsv = {
    //     data: freshsalesLeadsData.rows || [],
    //     filename: "leadsData",
    //     delimiter: ",",
    // };

    return (
        <div className="tw-grid tw-grid-cols-12 tw-gap-x-6 tw-gap-y-6 tw-p-8 tw-sticky">
            <DateFilterSection
                granularities={granularities}
                selectedGranularity={selectedGranularity}
                setSelectedGranularity={setSelectedGranularity}
                selectedMinDate={selectedMinDate}
                setSelectedMinDate={setSelectedMinDate}
                selectedMaxDate={selectedMaxDate}
                setSelectedMaxDate={setSelectedMaxDate}
                page={"business-insights"}
            />

            <div className="tw-col-span-12 tw-bg-dark-bg-400 tw-sticky tw-top-32 -tw-m-8 tw-mb-0 tw-shadow-[0px_10px_15px_-3px] tw-shadow-zinc-900 tw-z-30 tw-p-4 tw-grid tw-grid-cols-[auto_auto_auto_auto_auto_auto_auto_1fr_auto] tw-items-center tw-gap-x-4 tw-gap-y-4 tw-flex-wrap">
                <FancySearchableMultiSelect
                    label="Choose Category"
                    options={businesses}
                    selectedOptions={selectedCategories}
                    setSelectedOptions={setSelectedCategories}
                    filterType={QueryFilterType.category}
                />
                <FancySearchableMultiSelect
                    label="Choose Products"
                    options={products}
                    selectedOptions={selectedProducts}
                    setSelectedOptions={setSelectedProducts}
                    filterType={QueryFilterType.product}
                />
                <FancySearchableMultiSelect
                    label="Choose Platforms"
                    options={platforms}
                    selectedOptions={selectedPlatforms}
                    setSelectedOptions={setSelectedPlatforms}
                    filterType={QueryFilterType.platform}
                />
                <FancySearchableMultiSelect
                    label="Choose Campaigns"
                    options={campaigns}
                    selectedOptions={selectedCampaigns}
                    setSelectedOptions={setSelectedCampaigns}
                    filterType={QueryFilterType.campaign}
                />
            </div>

            {/* <button type="button" onClick={() => csvDownload(shopifyDataToExportAsCsv)} className="tw-lp-button">
                Export shopify as CSV
            </button>

            <button type="button" onClick={() => csvDownload(adsDataToExportAsCsv)} className="tw-lp-button">
                Export ads as CSV
            </button>

            <button type="button" onClick={() => csvDownload(leadsDataToExportAsCsv)} className="tw-lp-button">
                Export freshsales leads as CSV
            </button> */}

            <LeadsSection
                adsData={adsData}
                freshsalesLeadsData={freshsalesLeadsData}
                shopifyData={shopifyData}
                minDate={appliedMinDate}
                maxDate={appliedMaxDate}
                selectedCategories={selectedCategories}
                selectedProducts={selectedProducts}
                selectedPlatforms={selectedPlatforms}
                selectedCampaigns={selectedCampaigns}
                numberOfSelectedDays={numberOfSelectedDays}
            />

            <OrdersSection
                adsData={adsData}
                freshsalesLeadsData={freshsalesLeadsData}
                shopifyData={shopifyData}
                minDate={appliedMinDate}
                maxDate={appliedMaxDate}
                selectedCategories={selectedCategories}
                selectedProducts={selectedProducts}
                selectedPlatforms={selectedPlatforms}
                selectedCampaigns={selectedCampaigns}
                numberOfSelectedDays={numberOfSelectedDays}
            />

            {/* <RevenueSection
                adsData={adsData}
                freshsalesLeadsData={freshsalesLeadsData}
                shopifyData={shopifyData}
                minDate={appliedMinDate}
                maxDate={appliedMaxDate}
                selectedCategories={selectedCategories}
                selectedProducts={selectedProducts}
                selectedPlatforms={selectedPlatforms}
                selectedCampaigns={selectedCampaigns}
                numberOfSelectedDays={numberOfSelectedDays}
            /> */}

            <SpendSection
                adsData={adsData}
                freshsalesLeadsData={freshsalesLeadsData}
                shopifyData={shopifyData}
                minDate={appliedMinDate}
                maxDate={appliedMaxDate}
                selectedCategories={selectedCategories}
                selectedProducts={selectedProducts}
                selectedPlatforms={selectedPlatforms}
                selectedCampaigns={selectedCampaigns}
                numberOfSelectedDays={numberOfSelectedDays}
            />
        </div>
    );
}

function LeadsSection({
    freshsalesLeadsData,
    adsData,
    shopifyData,
    minDate,
    maxDate,
    selectedCategories,
    selectedProducts,
    selectedPlatforms,
    selectedCampaigns,
    numberOfSelectedDays,
}: {
    freshsalesLeadsData: FreshsalesData;
    adsData;
    shopifyData;
    minDate;
    maxDate;
    selectedCategories;
    selectedProducts;
    selectedPlatforms;
    selectedCampaigns;
    numberOfSelectedDays;
}) {
    // Metrics
    const [showAcos, setShowAcos] = useState(true);
    const [showCpl, setShowCpl] = useState(false);
    const [showSpl, setShowSpl] = useState(false);

    const filterFreshsalesData = freshsalesLeadsData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.platform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.campaign));

    const filterShopifyData = shopifyData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.sourcePlatform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.sourceCampaignName))
        .filter((row) => selectedProducts.length == 0 || selectedProducts.includes(row.productTitle));

    const filterAdsData = adsData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.platform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.campaignName));

    const defaultColumnDefinitions = {
        sortable: true,
        filter: true,
    };

    const dates = getDates(minDate, maxDate);

    // Performance Leads
    const performanceLeads = {
        countDayWise: aggregateByDate(
            filterFreshsalesData.filter((row) => doesLeadCaptureSourceCorrespondToPerformanceLead(row.leadCaptureSource)),
            "count",
            dates
        ),
        amountSpentDayWise: aggregateByDate(
            filterAdsData.filter((row) => doesAdsCampaignNameCorrespondToPerformanceLead(row.campaignName)),
            "amountSpent",
            dates
        ),
        netSalesDayWise: aggregateByDate(
            filterShopifyData.filter((row) => doesLeadCaptureSourceCorrespondToPerformanceLead(row.leadCaptureSource)),
            "netSales",
            dates
        ),
    };

    const performanceLeadsCount = {
        metaInformation: "Performance Leads",
        count: performanceLeads.countDayWise.reduce((sum, item) => sum + item, 0),
    };

    const performanceLeadsCpl = {
        metaInformation: `Amount Spent / Leads Count | Performance = ${numberToHumanFriendlyString(performanceLeads.amountSpentDayWise.reduce(sumReducer, 0))} / ${numberToHumanFriendlyString(
            performanceLeadsCount.count
        )}`,
        metaQuery: adsData.metaQuery,
        cpl: numberToHumanFriendlyString(performanceLeads.amountSpentDayWise.reduce(sumReducer, 0) / performanceLeadsCount.count),
        dayWiseCpl: performanceLeads.amountSpentDayWise.map((value, index) => (performanceLeads.countDayWise[index] == 0 ? 0 : value / performanceLeads.countDayWise[index])),
    };

    const performanceLeadsSpl = {
        metaInformation: `Leads Sales / Leads Count | Performance = ${numberToHumanFriendlyString(performanceLeads.netSalesDayWise.reduce(sumReducer))} / ${numberToHumanFriendlyString(
            performanceLeadsCount.count
        )}`,
        spl: performanceLeads.netSalesDayWise.reduce(sumReducer) / performanceLeadsCount.count,
        dayWiseSpl: performanceLeads.netSalesDayWise.map((value, index) => (performanceLeads.countDayWise[index] == 0 ? 0 : value / performanceLeads.countDayWise[index])),
    };

    const performanceLeadsAcos = {
        metaInformation: `Amount Spent / Net Sales | Performance = ${numberToHumanFriendlyString(performanceLeads.amountSpentDayWise.reduce(sumReducer))} / ${numberToHumanFriendlyString(
            performanceLeads.netSalesDayWise.reduce(sumReducer)
        )}`,
        acos: performanceLeads.amountSpentDayWise.reduce(sumReducer) / performanceLeads.netSalesDayWise.reduce(sumReducer),
        dayWiseAcos: performanceLeads.amountSpentDayWise.map((value, index) => (performanceLeads.netSalesDayWise[index] == 0 ? 0 : value / performanceLeads.netSalesDayWise[index])),
    };

    const facebookLeads = {
        countDayWise: aggregateByDate(
            filterFreshsalesData.filter((row) => !doesLeadCaptureSourceCorrespondToPerformanceLead(row.leadCaptureSource)),
            "count",
            dates
        ),
        amountSpentDayWise: aggregateByDate(
            filterAdsData.filter((row) => !doesAdsCampaignNameCorrespondToPerformanceLead(row.campaignName)),
            "amountSpent",
            dates
        ),
        netSalesDayWise: aggregateByDate(
            filterShopifyData.filter((row) => !doesLeadCaptureSourceCorrespondToPerformanceLead(row.leadCaptureSource)),
            "netSales",
            dates
        ),
    };

    const facebookLeadsCount = {
        metaInformation: "Facebook Leads",
        count: facebookLeads.countDayWise.reduce(sumReducer, 0),
    };

    const facebookLeadsCpl = {
        metaInformation: `Amount Spent / Leads Count | Facebook = ${numberToHumanFriendlyString(facebookLeads.amountSpentDayWise.reduce(sumReducer, 0))} / ${numberToHumanFriendlyString(
            facebookLeadsCount.count
        )}`,
        metaQuery: adsData.metaQuery,
        cpl: facebookLeads.amountSpentDayWise.reduce(sumReducer, 0) / facebookLeadsCount.count,
        dayWiseCpl: facebookLeads.amountSpentDayWise.map((value, index) => (facebookLeads.countDayWise[index] == 0 ? 0 : value / facebookLeads.countDayWise[index])),
    };

    const facebookLeadsSpl = {
        metaInformation: `Leads Sales / Leads Count | Facebook = ${numberToHumanFriendlyString(facebookLeads.netSalesDayWise.reduce(sumReducer, 0))} / ${numberToHumanFriendlyString(
            facebookLeadsCount.count
        )}`,
        spl: facebookLeads.netSalesDayWise.reduce(sumReducer, 0) / facebookLeadsCount.count,
        dayWiseSpl: facebookLeads.netSalesDayWise.map((value, index) => (facebookLeads.countDayWise[index] == 0 ? 0 : value / facebookLeads.countDayWise[index])),
    };

    const facebookLeadsAcos = {
        metaInformation: `Amount Spent / Net Sales | Facebook = ${numberToHumanFriendlyString(facebookLeads.amountSpentDayWise.reduce(sumReducer, 0))} / ${numberToHumanFriendlyString(
            facebookLeads.netSalesDayWise.reduce(sumReducer, 0)
        )}`,
        acos: facebookLeads.amountSpentDayWise.reduce(sumReducer, 0) / facebookLeads.netSalesDayWise.reduce(sumReducer, 0),
        dayWiseAcos: facebookLeads.amountSpentDayWise.map((value, index) => (facebookLeads.netSalesDayWise[index] == 0 ? 0 : value / facebookLeads.netSalesDayWise[index])),
    };

    const totalLeadsCount = {
        metaInformation: `Performance Leads + Facebook Leads = ${numberToHumanFriendlyString(performanceLeadsCount.count)} + ${numberToHumanFriendlyString(facebookLeadsCount.count)}`,
        count: performanceLeadsCount.count + facebookLeadsCount.count,
    };

    const dataTableForLeadsDayWise = dates.reduce((result, curDate, index) => {
        result[curDate] = {
            performanceLeadsCount: roundOffToTwoDigits(performanceLeads.countDayWise[index]),
            performanceLeadsCpl: roundOffToTwoDigits(performanceLeadsCpl.dayWiseCpl[index]),
            performanceLeadsSpl: roundOffToTwoDigits(performanceLeadsSpl.dayWiseSpl[index]),
            performanceLeadsAcos: roundOffToTwoDigits(performanceLeadsAcos.dayWiseAcos[index]),
            performanceLeadsnetSales: roundOffToTwoDigits(performanceLeads.netSalesDayWise[index]),
            facebookLeadsCount: roundOffToTwoDigits(facebookLeads.countDayWise[index]),
            facebookLeadsCpl: roundOffToTwoDigits(facebookLeadsCpl.dayWiseCpl[index]),
            facebookLeadsSpl: roundOffToTwoDigits(facebookLeadsSpl.dayWiseSpl[index]),
            facebookLeadsAcos: roundOffToTwoDigits(facebookLeadsAcos.dayWiseAcos[index]),
        };
        return result;
    }, {});

    //chartjs graphs
    ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

    const options = {
        responsive: true,
        // maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Day-wise distribution of total leads",
            },
        },
    };

    const labels = dates;
    const data = {
        labels,
        datasets: [
            {
                label: "Performance Leads",
                data: labels.map((date, index) => dataTableForLeadsDayWise[date].performanceLeadsCount),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Facebook Leads",
                data: labels.map((date, index) => dataTableForLeadsDayWise[date].facebookLeadsCount),
                backgroundColor: "rgba(53, 162, 235, 0.5)",
            },
        ],
    };

    const acosDayWiseOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Day-wise distribution",
            },
        },
    };

    const dayWiseAcos = {
        labels,
        datasets: [
            {
                label: "Performance Leads Acos",
                data: performanceLeadsAcos.dayWiseAcos,
                borderColor: "rgb(212, 172, 13)",
                backgroundColor: "rgb(212, 172, 13)",
            },
            {
                label: "Facebook Leads Acos",
                data: facebookLeadsAcos.dayWiseAcos,
                borderColor: "rgb(211, 84, 0)",
                backgroundColor: "rgb(211, 84, 0)",
            },
        ],
    };

    const cplDayWise = {
        labels,
        datasets: [
            {
                label: "Performance Leads Cpl",
                data: performanceLeadsCpl.dayWiseCpl,
                borderColor: "rgb(0, 102, 204)",
                backgroundColor: "rgb(0, 102, 204)",
            },
            {
                label: "Facebook Leads Cpl",
                data: facebookLeadsCpl.dayWiseCpl,
                borderColor: "rgb(211, 84, 100)",
                backgroundColor: "rgb(211, 84, 100)",
            },
        ],
    };

    const splDayWise = {
        labels,
        datasets: [
            {
                label: "Performance Leads Spl",
                data: performanceLeadsSpl.dayWiseSpl,
                borderColor: "rgb(179, 0, 179)",
                backgroundColor: "rgb(179, 0, 179)",
            },
            {
                label: "Facebook Leads Spl",
                data: facebookLeadsSpl.dayWiseSpl,
                borderColor: "rgb(51, 153, 102)",
                backgroundColor: "rgb(51, 153, 102)",
            },
        ],
    };

    return (
        <>
            <div className="tw-col-span-12 tw-text-[3rem] tw-text-center">Leads</div>

            <ValueDisplayingCard
                queryInformation={totalLeadsCount}
                contentExtractor={(totalLeadsCount: any) => totalLeadsCount.count}
                label="Total Leads"
                className="tw-row-span-2 tw-col-span-4"
                type={ValueDisplayingCardInformationType.integer}
            />

            <ValueDisplayingCard
                queryInformation={performanceLeadsCount}
                contentExtractor={(performanceLeadsCount: any) => performanceLeadsCount.count}
                label="Performance Leads"
                className="tw-col-span-2"
                type={ValueDisplayingCardInformationType.integer}
            />

            <Card
                information={numberToHumanFriendlyString(performanceLeadsCpl.cpl, true)}
                label="Performance Leads CPL"
                metaInformation={performanceLeadsCpl.metaInformation}
                metaQuery={performanceLeadsCpl.metaQuery}
                className="tw-col-span-2"
            />

            <Card
                information={numberToHumanFriendlyString(performanceLeadsSpl.spl, true)}
                label="Performance Leads SPL"
                metaInformation={performanceLeadsSpl.metaInformation}
                className="tw-col-span-2"
            />

            <Card
                information={numberToHumanFriendlyString(performanceLeadsAcos.acos, true, true, true)}
                label="Performance Leads ACoS"
                metaInformation={performanceLeadsAcos.metaInformation}
                className="tw-col-span-2"
            />

            <ValueDisplayingCard
                queryInformation={facebookLeadsCount}
                contentExtractor={(facebookLeadsCount: any) => facebookLeadsCount.count}
                label="Facebook Leads"
                className="tw-col-span-2"
                type={ValueDisplayingCardInformationType.integer}
            />

            <Card
                information={numberToHumanFriendlyString(facebookLeadsCpl.cpl, true)}
                label="Facebook Leads CPL"
                metaInformation={facebookLeadsCpl.metaInformation}
                metaQuery={facebookLeadsCpl.metaQuery}
                className="tw-col-span-2"
            />

            <Card information={numberToHumanFriendlyString(facebookLeadsSpl.spl, true)} label="Facebook Leads SPL" metaInformation={facebookLeadsSpl.metaInformation} className="tw-col-span-2" />

            <Card
                information={numberToHumanFriendlyString(facebookLeadsAcos.acos, true, true, true)}
                label="Facebook Leads ACoS"
                metaInformation={facebookLeadsAcos.metaInformation}
                className="tw-col-span-2"
            />

            <Tabs.Root defaultValue="1" className="tw-col-span-12">
                <Tabs.List className="">
                    <Tabs.Trigger value="1" className="lp-tab">
                        Distribution
                    </Tabs.Trigger>
                    <Tabs.Trigger value="2" className="lp-tab">
                        Raw Data
                    </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="1">
                    <div className="tw-grid">
                        <GenericCard
                            content={
                                <div className="tw-grid tw-grid-cols-4">
                                    <div className="tw-row-start-1 tw-col-start-2 tw-col-span-2 tw-grid">
                                        {showAcos && <Line options={options} data={dayWiseAcos} className="tw-row-start-1 tw-col-start-1" />}
                                        {showCpl && <Line options={acosDayWiseOptions} data={cplDayWise} className="tw-row-start-1 tw-col-start-1" />}
                                        {showSpl && <Line options={acosDayWiseOptions} data={splDayWise} className="tw-row-start-1 tw-col-start-1" />}

                                        <Bar options={options} data={data} className="tw-row-start-1 tw-col-start-1" />
                                    </div>

                                    <div className="tw-row-start-2 tw-col-start-1 tw-col-span-4 tw-flex tw-flex-row tw-justify-center">
                                        <input type="checkbox" id="acos" checked={showAcos} onChange={(e) => setShowAcos(e.target.checked)} />
                                        <label htmlFor="acos" className="tw-pl-2">
                                            ACoS
                                        </label>

                                        <HorizontalSpacer className="tw-w-8" />

                                        <input type="checkbox" id="cpl" checked={showCpl} onChange={(e) => setShowCpl(e.target.checked)} />
                                        <label htmlFor="cpl" className="tw-pl-2">
                                            CPL
                                        </label>

                                        <HorizontalSpacer className="tw-w-8" />

                                        <input type="checkbox" id="spl" checked={showSpl} onChange={(e) => setShowSpl(e.target.checked)} />
                                        <label htmlFor="spl" className="tw-pl-2">
                                            SPL
                                        </label>
                                    </div>
                                </div>
                            }
                            metaQuery={freshsalesLeadsData.metaQuery}
                        ></GenericCard>
                    </div>
                </Tabs.Content>
                <Tabs.Content value="2">
                    <GenericCard
                        className="tw-col-span-12"
                        content={
                            <div className="tw-col-span-12 tw-h-[640px] ag-theme-alpine-dark">
                                <AgGridReact
                                    rowData={dates.map((date, dateIndex) => ({
                                        date: date,
                                        performanceLeads: dataTableForLeadsDayWise[date].performanceLeadsCount,
                                        performanceLeadsCpl: dataTableForLeadsDayWise[date].performanceLeadsCpl,
                                        performanceLeadsSpl: dataTableForLeadsDayWise[date].performanceLeadsSpl,
                                        performanceLeadsAcos: dataTableForLeadsDayWise[date].performanceLeadsAcos,
                                        performanceLeadsnetSales: dataTableForLeadsDayWise[date].performanceLeadsnetSales,
                                        facebookLeads: dataTableForLeadsDayWise[date].facebookLeadsCount,
                                        facebookLeadsCpl: dataTableForLeadsDayWise[date].facebookLeadsCpl,
                                        facebookLeadsSpl: dataTableForLeadsDayWise[date].facebookLeadsSpl,
                                        facebookLeadsAcos: dataTableForLeadsDayWise[date].facebookLeadsAcos,
                                    }))}
                                    columnDefs={[
                                        {
                                            headerName: "Lead Created At",
                                            valueGetter: (params) => dateToMediumNoneEnFormat(params.data.date),
                                            filter: "agDateColumnFilter",
                                            comparator: agGridDateComparator,
                                        },
                                        {headerName: "Performance Leads Count", field: "performanceLeads"},
                                        {headerName: "Performance Leads CPL", field: "performanceLeadsCpl"},
                                        {headerName: "Performance Leads SPL", field: "performanceLeadsSpl"},
                                        {headerName: "Performance Leads ACOS", field: "performanceLeadsAcos"},
                                        {headerName: "Performance Leads NetSales", field: "performanceLeadsnetSales"},
                                        {headerName: "Facebook Leads Count", field: "facebookLeads"},
                                        {headerName: "Facebook Leads CPL", field: "facebookLeadsCpl"},
                                        {headerName: "Facebook Leads SPL", field: "facebookLeadsSpl"},
                                        {headerName: "Facebook Leads ACOS", field: "facebookLeadsAcos"},
                                    ]}
                                    defaultColDef={defaultColumnDefinitions}
                                    animateRows={true}
                                    enableRangeSelection={true}
                                />
                            </div>
                        }
                        metaQuery={freshsalesLeadsData.metaQuery}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </>
    );
}

function OrdersSection({freshsalesLeadsData, adsData, shopifyData, minDate, maxDate, selectedCategories, selectedProducts, selectedPlatforms, selectedCampaigns, numberOfSelectedDays}) {
    const filterShopifyData = shopifyData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.sourcePlatform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.sourceCampaignName))
        .filter((row) => selectedProducts.length == 0 || selectedProducts.includes(row.productTitle));

    const defaultColumnDefinitions = {
        sortable: true,
        filter: true,
    };
    const dates = getDates(minDate, maxDate);

    // Direct Orders calculations
    const directOrdersRevenueGroupByDateAndCategory = get_r3_ordersRevenue(filterShopifyData.filter((row) => row.isAssisted == false));
    const directOrders = {
        dayWiseCount: aggregateByDate(
            filterShopifyData.filter((row) => row.isAssisted == false),
            "netQuantity",
            dates
        ),
        dayWiseNetSales: aggregateByDate(directOrdersRevenueGroupByDateAndCategory, "netSales", dates),
    };

    const directOrdersTotalCount = directOrders.dayWiseCount.reduce(sumReducer, 0);
    const directOrdersNetSales = directOrders.dayWiseNetSales.reduce(sumReducer, 0);

    const r2_directOrdersAov = {
        metaInformation: `Orders Revenue / Orders Count | Direct = ${numberToHumanFriendlyString(directOrdersNetSales)} / ${numberToHumanFriendlyString(directOrdersTotalCount)}`,
        aov: directOrdersNetSales / directOrdersTotalCount,
        dayWiseAov: directOrders.dayWiseNetSales.map((value, index) => (directOrders.dayWiseCount[index] == 0 ? 0 : value / directOrders.dayWiseCount[index])),
    };

    const r2_directOrdersDrr = {
        metaInformation: `Total Direct Orders / Number of Days | Direct = ${numberToHumanFriendlyString(directOrdersTotalCount)} / ${numberToHumanFriendlyString(numberOfSelectedDays)}`,
        drr: directOrdersTotalCount / numberOfSelectedDays,
    };

    // Assisted Orders calculations
    const assistedOrdersRevenueGroupByDateAndCategory = get_r3_ordersRevenue(filterShopifyData.filter((row) => row.isAssisted == true));

    const assistedOrders = {
        dayWiseCount: aggregateByDate(
            filterShopifyData.filter((row) => row.isAssisted == true),
            "netQuantity",
            dates
        ),
        dayWiseNetSales: aggregateByDate(assistedOrdersRevenueGroupByDateAndCategory, "netSales", dates),
    };

    const assistedOrdersTotalCount = assistedOrders.dayWiseCount.reduce(sumReducer, 0);
    const assistedOrdersNetSales = assistedOrders.dayWiseNetSales.reduce(sumReducer, 0);

    const r2_assistedOrdersAov = {
        metaInformation: `Orders Revenue / Orders Count | Assisted = ${numberToHumanFriendlyString(assistedOrdersNetSales)} / ${numberToHumanFriendlyString(assistedOrdersTotalCount)}`,
        aov: assistedOrdersNetSales / assistedOrdersTotalCount,
        dayWiseAov: assistedOrders.dayWiseNetSales.map((value, index) => (assistedOrders.dayWiseCount[index] == 0 ? 0 : value / assistedOrders.dayWiseCount[index])),
    };

    const r2_assistedOrdersDrr = {
        metaInformation: `Total Assisted Orders / Number of Days | Assisted = ${numberToHumanFriendlyString(assistedOrdersTotalCount)} / ${numberToHumanFriendlyString(numberOfSelectedDays)}`,
        drr: assistedOrdersTotalCount / numberOfSelectedDays,
    };

    const dataTableForOrdersDayWise = dates.reduce((result, curDate, index) => {
        result[curDate] = {
            directOrdersCount: roundOffToTwoDigits(directOrders.dayWiseCount[index]),
            directOrdersNetSales: roundOffToTwoDigits(directOrders.dayWiseNetSales[index]),
            directOrdersAov: roundOffToTwoDigits(r2_directOrdersAov.dayWiseAov[index]),
            assistedOrdersCount: roundOffToTwoDigits(assistedOrders.dayWiseCount[index]),
            assistedOrdersNetSales: roundOffToTwoDigits(directOrders.dayWiseNetSales[index]),
            assistedOrdersAov: roundOffToTwoDigits(r2_assistedOrdersAov.dayWiseAov[index]),
        };
        return result;
    }, {});

    // Total Orders
    const r2_totalOrdersCount = {
        metaInformation: `Direct Orders + Assisted Orders = ${numberToHumanFriendlyString(directOrders.dayWiseCount.reduce(sumReducer, 0))} + ${numberToHumanFriendlyString(assistedOrders.count)}`,
        count: directOrdersTotalCount + assistedOrders.dayWiseCount.reduce(sumReducer, 0),
    };

    ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Daywise distribution of Orders Count",
            },
        },
    };

    const labels = dates;
    const data = {
        labels,
        datasets: [
            {
                label: "Direct Orders",
                data: labels.map((date) => dataTableForOrdersDayWise[date].directOrdersCount),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
                borderColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Assisted Orders",
                data: labels.map((date) => dataTableForOrdersDayWise[date].assistedOrdersCount),
                backgroundColor: "rgba(53, 162, 235, 0.5)",
                borderColor: "rgba(53, 162, 235, 0.5)",
            },
        ],
    };

    return (
        <>
            <div className="tw-col-span-12 tw-text-[3rem] tw-text-center">Orders</div>

            <ValueDisplayingCard
                queryInformation={r2_totalOrdersCount}
                contentExtractor={(r2_totalOrdersCount: any) => r2_totalOrdersCount.count}
                label="Total Orders"
                className="tw-row-span-2 tw-col-span-4"
                type={ValueDisplayingCardInformationType.integer}
            />

            <Card information={numberToHumanFriendlyString(directOrdersTotalCount)} label="Direct Orders" metaQuery={shopifyData.metaQuery} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r2_directOrdersAov.aov, true)} label="AOV" metaInformation={r2_directOrdersAov.metaInformation} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r2_directOrdersDrr.drr, true)} label="DRR" metaInformation={r2_directOrdersDrr.metaInformation} className="tw-col-span-2" />

            <div className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(assistedOrdersTotalCount)} label="Assisted Orders" metaQuery={shopifyData.metaQuery} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r2_assistedOrdersAov.aov, true)} label="AOV" metaInformation={r2_assistedOrdersAov.metaInformation} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r2_assistedOrdersDrr.drr, true)} label="DRR" metaInformation={r2_assistedOrdersDrr.metaInformation} className="tw-col-span-2" />

            <div className="tw-col-span-2" />

            <Tabs.Root defaultValue="1" className="tw-col-span-12">
                <Tabs.List>
                    <Tabs.Trigger value="1" className="lp-tab">
                        Distribution
                    </Tabs.Trigger>
                    <Tabs.Trigger value="2" className="lp-tab">
                        Raw Data
                    </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="1">
                    <GenericCard
                        content={
                            <div className="tw-grid tw-grid-cols-4">
                                <div className="tw-col-start-2 tw-col-span-2">
                                    <Line options={options} data={data} />
                                </div>
                            </div>
                        }
                        metaQuery={shopifyData.metaQuery}
                    />
                </Tabs.Content>
                <Tabs.Content value="2">
                    <GenericCard
                        content={
                            <div className="tw-col-span-12 tw-h-[640px] ag-theme-alpine-dark">
                                <AgGridReact
                                    rowData={dates.map((date, dateIndex) => ({
                                        date: date,
                                        directOrdersCount: dataTableForOrdersDayWise[date].directOrdersCount,
                                        directOrdersAov: dataTableForOrdersDayWise[date].directOrdersAov,
                                        assistedOrdersCount: dataTableForOrdersDayWise[date].assistedOrdersCount,
                                        assistedOrdersAov: dataTableForOrdersDayWise[date].assistedOrdersAov,
                                        directOrdersNetSales: dataTableForOrdersDayWise[date].directOrdersNetSales,
                                        assistedOrdersNetSales: dataTableForOrdersDayWise[date].assistedOrdersNetSales,
                                    }))}
                                    columnDefs={[
                                        {headerName: "Date", valueGetter: (params) => dateToMediumNoneEnFormat(params.data.date), filter: "agDateColumnFilter", comparator: agGridDateComparator},
                                        {headerName: "Direct Orders Count", field: "directOrdersCount"},
                                        {headerName: "Direct Orders AOV", field: "directOrdersAov"},
                                        {headerName: "Direct Orders NetSales", field: "directOrdersNetSales"},
                                        {headerName: "Assisted Orders Count", field: "assistedOrdersCount"},
                                        {headerName: "Assisted Orders AOV", field: "assistedOrdersAov"},
                                        {headerName: "Assisted Orders NetSales", field: "assistedOrdersNetSales"},
                                    ]}
                                    defaultColDef={defaultColumnDefinitions}
                                    animateRows={true}
                                    enableRangeSelection={true}
                                />
                            </div>
                        }
                        metaQuery={shopifyData.metaQuery}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </>
    );
}

function RevenueSection({freshsalesLeadsData, adsData, shopifyData, minDate, maxDate, selectedCategories, selectedProducts, selectedPlatforms, selectedCampaigns, numberOfSelectedDays}) {
    const filterShopifyData = shopifyData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.sourcePlatform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.sourceCampaignName))
        .filter((row) => selectedProducts.length == 0 || selectedProducts.includes(row.productTitle));

    const defaultColumnDefinitions = {
        sortable: true,
        filter: true,
    };

    const directOrdersRevenue = get_r3_ordersRevenue(filterShopifyData.filter((row) => row.isAssisted == false));

    const assistedOrdersRevenueGroupByDateAndCategory = get_r3_ordersRevenue(filterShopifyData.filter((row) => row.isAssisted == true));

    const dates = getDates(minDate, maxDate);

    const directOrdersGrossRevenue = {
        grossRevenueDayWise: aggregateByDate(directOrdersRevenue, "netSales", dates),
    };

    const assistedOrdersGrossRevenue = {
        grossRevenueDayWise: aggregateByDate(assistedOrdersRevenueGroupByDateAndCategory, "netSales", dates),
    };

    const r3_directOrdersNetRevenue = {
        metaInformation: "",
        netRevenueDayWise: aggregateByDate(
            directOrdersRevenue.map((row) => ({...row, netRevenue: getNetRevenue(row)})),
            "netRevenue",
            dates
        ),
    };

    const r3_assistedOrdersNetRevenue = {
        metaInformation: "",
        netRevenueDayWise: aggregateByDate(
            assistedOrdersRevenueGroupByDateAndCategory.map((row) => ({...row, netRevenue: getNetRevenue(row)})),
            "netRevenue",
            dates
        ),
    };
    const r3_totalNetRevenue = {
        metaInformation: "",
        netRevenue: r3_directOrdersNetRevenue.netRevenueDayWise.reduce(sumReducer, 0) + r3_assistedOrdersNetRevenue.netRevenueDayWise.reduce(sumReducer, 0),
    };

    const dataTableForRevenueDayWise = dates.reduce((result, curDate, index) => {
        result[curDate] = {
            directOrdersGrossRevenue: roundOffToTwoDigits(directOrdersGrossRevenue.grossRevenueDayWise[index]),
            directOrdersNetRevenue: roundOffToTwoDigits(r3_directOrdersNetRevenue.netRevenueDayWise[index]),
            assistedOrdersGrossRevenue: roundOffToTwoDigits(assistedOrdersGrossRevenue.grossRevenueDayWise[index]),
            assistedOrdersNetRevenue: roundOffToTwoDigits(r3_assistedOrdersNetRevenue.netRevenueDayWise[index]),
        };
        return result;
    }, {});

    ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

    const ordersGrossRevenueOptions = {
        responsive: true,
        // maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Orders vs Gross Revenue Bar Graph",
            },
        },
    };

    const ordersNetRevenueOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Orders vs Net Revenue Bar Graph",
            },
        },
    };

    const labels = Object.keys(dataTableForRevenueDayWise);
    const ordersGrossRevenueData = {
        labels,
        datasets: [
            {
                label: "Direct Orders",
                data: labels.map((date) => dataTableForRevenueDayWise[date].directOrdersGrossRevenue),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Assisted Orders",
                data: labels.map((date) => dataTableForRevenueDayWise[date].assistedOrdersGrossRevenue),
                backgroundColor: "rgba(53, 162, 235, 0.5)",
            },
        ],
    };

    const ordersNetRevenueData = {
        labels,
        datasets: [
            {
                label: "Direct Orders",
                data: labels.map((date) => dataTableForRevenueDayWise[date].directOrdersNetRevenue),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Assisted Orders",
                data: labels.map((date) => dataTableForRevenueDayWise[date].assistedOrdersNetRevenue),
                backgroundColor: "rgba(53, 162, 235, 0.5)",
            },
        ],
    };

    return (
        <>
            <div className="tw-col-span-12 tw-text-[3rem] tw-text-center">Revenue</div>

            <Card
                information={numberToHumanFriendlyString(r3_totalNetRevenue.netRevenue)}
                label="Net Revenue"
                metaInformation={r3_totalNetRevenue.metaInformation}
                className="tw-row-span-2 tw-col-span-4"
            />

            <Card
                information={numberToHumanFriendlyString(directOrdersGrossRevenue.grossRevenueDayWise.reduce(sumReducer, 0), true)}
                label="Direct Gross Revenue"
                metaQuery={shopifyData.metaQuery}
                className="tw-col-span-2"
            />

            <Card
                information={numberToHumanFriendlyString(r3_directOrdersNetRevenue.netRevenueDayWise.reduce(sumReducer, 0), true)}
                label="Net Direct Revenue"
                metaInformation={r3_directOrdersNetRevenue.metaInformation}
                className="tw-col-span-2"
            />

            <div className="tw-col-span-2" />

            <div className="tw-col-span-2" />

            <Card
                information={numberToHumanFriendlyString(assistedOrdersGrossRevenue.grossRevenueDayWise.reduce(sumReducer, 0), true)}
                label="Assisted Gross Revenue"
                metaQuery={shopifyData.metaQuery}
                className="tw-col-span-2"
            />

            <Card
                information={numberToHumanFriendlyString(r3_assistedOrdersNetRevenue.netRevenueDayWise.reduce(sumReducer, 0), true)}
                label="Net Assisted Revenue"
                metaInformation={r3_assistedOrdersNetRevenue.metaInformation}
                className="tw-col-span-2"
            />

            <div className="tw-col-span-2" />

            <div className="tw-col-span-2" />

            <Tabs.Root defaultValue="1" className="tw-col-span-12">
                <Tabs.List className="">
                    <Tabs.Trigger value="1" className="lp-tab">
                        Gross Revenue
                    </Tabs.Trigger>
                    <Tabs.Trigger value="2" className="lp-tab">
                        Net Revenue
                    </Tabs.Trigger>
                    <Tabs.Trigger value="3" className="lp-tab">
                        Raw Data
                    </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="1">
                    <GenericCard
                        content={
                            <div className="tw-grid tw-grid-cols-4">
                                <div className="tw-col-start-2 tw-col-span-2">
                                    <Bar options={ordersGrossRevenueOptions} data={ordersGrossRevenueData} />
                                </div>
                            </div>
                        }
                        metaQuery={adsData.metaQuery}
                        label="Daywise distribution of Gross Revenue"
                    />
                </Tabs.Content>
                <Tabs.Content value="2">
                    <GenericCard
                        content={
                            <div className="tw-grid tw-grid-cols-4">
                                <div className="tw-col-start-2 tw-col-span-2">
                                    <Bar options={ordersNetRevenueOptions} data={ordersNetRevenueData} />
                                </div>
                            </div>
                        }
                        metaQuery={shopifyData.metaQuery}
                        label="Daywise distribution of Net Revenue"
                    />
                </Tabs.Content>
                <Tabs.Content value="3">
                    <GenericCard
                        content={
                            <div className="tw-col-span-12 tw-h-[640px] ag-theme-alpine-dark">
                                <AgGridReact
                                    rowData={dates.map((date, dateIndex) => ({
                                        date: date,
                                        directOrdersGrossRevenue: dataTableForRevenueDayWise[date].directOrdersGrossRevenue,
                                        directOrdersNetRevenue: dataTableForRevenueDayWise[date].directOrdersNetRevenue,
                                        assistedOrdersGrossRevenue: dataTableForRevenueDayWise[date].assistedOrdersGrossRevenue,
                                        assistedOrdersNetRevenue: dataTableForRevenueDayWise[date].assistedOrdersNetRevenue,
                                    }))}
                                    columnDefs={[
                                        {headerName: "Date", valueGetter: (params) => dateToMediumNoneEnFormat(params.data.date), filter: "agDateColumnFilter", comparator: agGridDateComparator},
                                        {headerName: "Direct Orders Gross Revenue", field: "directOrdersGrossRevenue"},
                                        {headerName: "Direct Orders Net Revenue", field: "directOrdersNetRevenue"},
                                        {headerName: "Assisted Orders Gross Revenue", field: "assistedOrdersGrossRevenue"},
                                        {headerName: "Direct Orders Net Revenue", field: "assistedOrdersNetRevenue"},
                                    ]}
                                    defaultColDef={defaultColumnDefinitions}
                                    animateRows={true}
                                    enableRangeSelection={true}
                                />
                            </div>
                        }
                        metaQuery={shopifyData.metaQuery}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </>
    );
}

function SpendSection({freshsalesLeadsData, adsData, shopifyData, minDate, maxDate, selectedCategories, selectedProducts, selectedPlatforms, selectedCampaigns, numberOfSelectedDays}) {
    const filterShopifyData = shopifyData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.sourcePlatform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.sourceCampaignName))
        .filter((row) => selectedProducts.length == 0 || selectedProducts.includes(row.productTitle));

    const filterAdsData = adsData.rows
        .filter((row) => selectedCategories.length == 0 || selectedCategories.includes(row.category))
        .filter((row) => selectedPlatforms.length == 0 || selectedPlatforms.includes(row.platform))
        .filter((row) => selectedCampaigns.length == 0 || selectedCampaigns.includes(row.campaignName));

    const defaultColumnDefinitions = {
        sortable: true,
        filter: true,
    };

    const dates = getDates(minDate, maxDate);

    // Google Ads
    const googleAds = {
        amountSpentDayWise: aggregateByDate(
            filterAdsData.filter((row) => row.platform == "Google"),
            "amountSpent",
            dates
        ),
        netSalesDayWise: aggregateByDate(
            filterShopifyData.filter((row) => row.sourcePlatform == "Google" && row.netSales > 0),
            "netSales",
            dates
        ),
    };

    const r4_googleAdsRevenue = {
        netSales: googleAds.netSalesDayWise.reduce(sumReducer, 0),
    };

    const googleAdsSpends = {
        amountSpent: googleAds.amountSpentDayWise.reduce(sumReducer, 0),
    };

    const r4_googleAdsLiveCampaignsCount = {
        count: distinct(filterAdsData.filter((row) => row.platform == "Google" && row.amountSpent > 0).map((row) => row.campaignName)).length,
    };

    const r4_googleAdsDailySpend = {
        metaInformation: `Total Spend / Number of Days | Google = ${googleAdsSpends.amountSpent} / ${numberOfSelectedDays}`,
        amountSpent: googleAdsSpends.amountSpent / numberOfSelectedDays,
    };

    const r4_googleAdsAcos = {
        metaInformation: `Total Spend / Revenue | Google = ${googleAdsSpends.amountSpent} / ${r4_googleAdsRevenue.netSales}`,
        acos: r4_googleAdsRevenue.netSales == 0 ? 0 : googleAdsSpends.amountSpent / r4_googleAdsRevenue.netSales,
        dayWiseAcos: googleAds.amountSpentDayWise.map((value, index) => (googleAds.netSalesDayWise[index] == 0 ? 0 : value / googleAds.netSalesDayWise[index])),
    };

    // Facebook Spends
    const facebookAds = {
        amountSpentDayWise: aggregateByDate(
            filterAdsData.filter((row) => row.platform == "Facebook"),
            "amountSpent",
            dates
        ),
        netSalesDayWise: aggregateByDate(
            filterShopifyData.filter((row) => row.sourcePlatform == "Facebook" && row.netSales > 0),
            "netSales",
            dates
        ),
    };

    const r4_facebookAdsRevenue = {
        netSales: facebookAds.netSalesDayWise.reduce(sumReducer, 0),
    };

    const facebookAdsSpends = {
        amountSpent: facebookAds.amountSpentDayWise.reduce(sumReducer, 0),
    };

    const r4_facebookAdsLiveCampaignsCount = {
        count: distinct(filterAdsData.filter((row) => row.platform == "Facebook" && row.amountSpent > 0).map((row) => row.campaignName)).length,
    };

    const r4_facebookAdsAcos = {
        metaInformation: `Total Spend / Revenue | Facebook = ${facebookAdsSpends.amountSpent} / ${r4_facebookAdsRevenue.netSales}`,
        acos: facebookAdsSpends.amountSpent / r4_facebookAdsRevenue.netSales,
        dayWiseAcos: facebookAds.amountSpentDayWise.map((value, index) => (facebookAds.netSalesDayWise[index] == 0 ? 0 : value / facebookAds.netSalesDayWise[index])),
    };

    const r4_facebookAdsDailySpend = {
        metaInformation: `Total Spend / Number of Days | Facebook = ${facebookAdsSpends.amountSpent} / ${numberOfSelectedDays}`,
        amountSpent: facebookAdsSpends.amountSpent / numberOfSelectedDays,
    };

    // Data Table for daywise distribution
    const dataTableForSpendsDayWise = dates.reduce((result, curDate, index) => {
        result[curDate] = {
            googleAdsAmountSpent: roundOffToTwoDigits(googleAds.amountSpentDayWise[index]),
            googleAdsNetSales: roundOffToTwoDigits(googleAds.netSalesDayWise[index]),
            googleAdsAcos: roundOffToTwoDigits(r4_googleAdsAcos.dayWiseAcos[index]),
            facebookAdsAmountSpent: roundOffToTwoDigits(facebookAds.amountSpentDayWise[index]),
            facebookAdsNetSales: roundOffToTwoDigits(facebookAds.netSalesDayWise[index]),
            facebookAdsAcos: roundOffToTwoDigits(r4_facebookAdsAcos.dayWiseAcos[index]),
        };
        return result;
    }, {});

    const r4_netSpends = {
        metaInformation: `Facebook Ads Spends + Google Ads Spends = ${facebookAdsSpends.amountSpent} + ${googleAdsSpends.amountSpent}`,
        amountSpent: facebookAdsSpends.amountSpent + googleAdsSpends.amountSpent,
    };

    ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

    const adsDataSpendsOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "Daywise distribution of Amount Spent on advertisements",
            },
        },
    };

    const labels = dates;
    const adsDataSpendsData = {
        labels,
        datasets: [
            {
                label: "Google Ads Spend",
                data: labels.map((item, index) => googleAds.amountSpentDayWise[index]),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Facebook Ads Spend",
                data: labels.map((item, index) => facebookAds.amountSpentDayWise[index]),
                backgroundColor: "rgba(53, 162, 235, 0.5)",
            },
        ],
    };

    return (
        <>
            <div className="tw-col-span-12 tw-text-[3rem] tw-text-center">Spend</div>

            <Card information={numberToHumanFriendlyString(r4_netSpends.amountSpent)} label="Net Spend" metaInformation={r4_netSpends.metaInformation} className="tw-row-span-2 tw-col-span-4" />

            <Card information={numberToHumanFriendlyString(facebookAdsSpends.amountSpent)} label="Facebook Ads" metaQuery={adsData.metaQuery} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r4_facebookAdsLiveCampaignsCount.count)} label="Live Campaigns" metaQuery={adsData.metaQuery} className="tw-col-span-2" />

            <Card
                information={numberToHumanFriendlyString(r4_facebookAdsDailySpend.amountSpent, true)}
                label="Daily Spend"
                metaInformation={r4_facebookAdsDailySpend.metaInformation}
                className="tw-col-span-2"
            />

            <Card information={numberToHumanFriendlyString(r4_facebookAdsAcos.acos, true, true, true)} label="ACoS" metaInformation={r4_facebookAdsAcos.metaInformation} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(googleAdsSpends.amountSpent)} label="Google Ads" metaQuery={adsData.metaQuery} className="tw-col-span-2" />

            <Card information={numberToHumanFriendlyString(r4_googleAdsLiveCampaignsCount.count)} label="Live Campaigns" metaQuery={adsData.metaQuery} className="tw-col-span-2" />

            <Card
                information={numberToHumanFriendlyString(r4_googleAdsDailySpend.amountSpent, true)}
                label="Daily Spend"
                metaInformation={r4_googleAdsDailySpend.metaInformation}
                className="tw-col-span-2"
            />

            <Card information={numberToHumanFriendlyString(r4_googleAdsAcos.acos, true, true, true)} label="ACoS" metaInformation={r4_googleAdsAcos.metaInformation} className="tw-col-span-2" />

            <Tabs.Root defaultValue="1" className="tw-col-span-12">
                <Tabs.List className="">
                    <Tabs.Trigger value="1" className="lp-tab">
                        Distribution
                    </Tabs.Trigger>
                    <Tabs.Trigger value="2" className="lp-tab">
                        Raw Data
                    </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="1">
                    <GenericCard
                        content={
                            <div className="tw-grid tw-grid-cols-4">
                                <div className="tw-col-start-2 tw-col-span-2">
                                    <Bar options={adsDataSpendsOptions} data={adsDataSpendsData} />
                                </div>
                            </div>
                        }
                        metaQuery={adsData.metaQuery}
                    />
                </Tabs.Content>
                <Tabs.Content value="2">
                    <GenericCard
                        content={
                            <div className="tw-col-span-12 tw-h-[640px] ag-theme-alpine-dark">
                                <AgGridReact
                                    rowData={dates.map((date, dateIndex) => ({
                                        date: date,
                                        googleAdsAmountSpent: dataTableForSpendsDayWise[date].googleAdsAmountSpent,
                                        googleAdsNetSales: dataTableForSpendsDayWise[date].googleAdsNetSales,
                                        googleAdsAcos: dataTableForSpendsDayWise[date].googleAdsAcos,
                                        facebookAdsAmountSpent: dataTableForSpendsDayWise[date].facebookAdsAmountSpent,
                                        facebookAdsNetSales: dataTableForSpendsDayWise[date].facebookAdsNetSales,
                                        facebookAdsAcos: dataTableForSpendsDayWise[date].facebookAdsAcos,
                                    }))}
                                    columnDefs={[
                                        {headerName: "Date", valueGetter: (params) => dateToMediumNoneEnFormat(params.data.date), filter: "agDateColumnFilter", comparator: agGridDateComparator},
                                        {headerName: "Google-Ads Amount Spent", field: "googleAdsAmountSpent"},
                                        {headerName: "Google-Ads Net Sales", field: "googleAdsNetSales"},
                                        {headerName: "Google-Ads ACoS", field: "googleAdsAcos"},
                                        {headerName: "Facebook-Ads Amount Spent", field: "facebookAdsAmountSpent"},
                                        {headerName: "Facebook-Ads Net Sales", field: "facebookAdsNetSales"},
                                        {headerName: "Facebook-Ads ACoS", field: "facebookAdsAcos"},
                                    ]}
                                    defaultColDef={defaultColumnDefinitions}
                                    animateRows={true}
                                    enableRangeSelection={true}
                                />
                            </div>
                        }
                        metaQuery={shopifyData.metaQuery}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </>
    );
}

function get_r3_ordersRevenue(shopifyData: Array<object>) {
    let aggregateByDate = shopifyData.reduce(createGroupByReducer("date"), {});

    for (const date in aggregateByDate) {
        let result = aggregateByDate[date].reduce(createGroupByReducer("category"), {});
        aggregateByDate[date] = result;
    }

    let result = [];
    for (const date in aggregateByDate) {
        for (const category in aggregateByDate[date]) {
            const totalNetSales = aggregateByDate[date][category].reduce((total, item) => total + item.netSales, 0);
            result.push({
                date: date,
                category: category,
                netSales: totalNetSales,
            });
        }
    }
    return result;
}

function aggregateByDate(arr: Array<object>, param: string, dates: Array<string>) {
    const counts = dates.map((date) => arr.filter((x) => x.date == date).reduce((total, x) => total + x[param], 0));

    const sum1 = arr.reduce((total, x) => total + x[param], 0);
    const sum2 = counts.reduce((total, x) => total + x, 0);
    if (Math.abs(sum1 - sum2) > 0.1) {
        console.log("SUMS DON'T ADD UP!", sum1, sum2);
    }

    return counts;
}

function getNetRevenue(row): number {
    let returnProvision;

    if (row.category == "Mattress" || row.category == "Non Mattress") {
        returnProvision = 8.5;
    } else if (row.category == "Water Purifier") {
        returnProvision = 10;
    } else if (row.category == "Appliances") {
        returnProvision = 1.18;
    } else if (row.category == null) {
        // TODO: Remove
        returnProvision = 0;
    } else if (row.category == "null") {
        // TODO: Remove
        returnProvision = 0;
    } else {
        throw new Error(`returnProvision for category ${row.category} not specified!`);
    }

    return (row.netSales / 1.18) * (1 - returnProvision / 100);
}

function sumReducer(total: number, sum: number) {
    return total + sum;
}
